# Hermes delivery obligation

Status: locked 2026-10-04. Base: `e225f3e1`. Behaviour-preserving engine
refactor guarded by `npm run test:equivalence` before and after every gate; the
baseline must not change.

## Objective

One engine product, the delivery obligation, describes where and how a Shrine
of Hermes purchase arrives, and every consumer reads it instead of recomputing
the rule. The audit found the due-contact rule computed eight ways and the
same-room, purchase-lookup and flush-host predicates copied four to seven
times. After this refactor each lives once.

## Scope

Included: `packages/planner-engine` only. A `HermesDeliveryObligation` product;
shared predicates; consumers rewired; dead code deleted (`deliveryKind` variants
that never emit, the test-only `hermesShrineDeliveryPlacementForPurchaseReschedule`
and its fixture uses). Excluded: application and module code, protocol, any
change to findings, placement legality, settlement predicates' meaning, or
timing rules. If movement exposes a defect, characterize it and stop; fix it in
a separate commit.

## Product

```ts
interface HermesDeliveryObligation {
  readonly entryKey: string; // persisted identity, unchanged
  readonly source: OccurrenceAddress; // Shrine room
  readonly generationKey: HermesShrineGenerationKey;
  readonly rewardType: string; // purchased offer type
  readonly rushed: boolean;
  readonly due?: {
    // undefined while counting down
    readonly host: OccurrenceAddress;
    readonly encounterPhaseKey?: string; // absent for rush and flush
    readonly cause: 'rush' | 'countdown' | 'flush';
    readonly historySequence: number;
  };
}
```

Produced by the scheduler at scheduling (`acquisition-point-reached.ts`
scheduling branch, rush sets `due` immediately), updated by countdown
(`encounter-end-effects.ts`) and flush (`room-entered.ts`), carried in branch
state in place of `PendingHermesShrineDelivery`'s loose fields, published
through chronology as the authoritative description.

Shared predicates in `authored-project/hermes-shrine-delivery.ts`:
`isSameRoomDelivery(source, host)`, `purchaseFor(shrine, generationKey)`,
`isDeliveryFlushHost` (exists), `dueContactMatches(obligation, host, phase?)`.

## Consumers to rewire

- Frontier and placement-required finding (`lifecycle-transitions/hermes-shrine-delivery.ts`).
- Reached placement assessment (`generated-pickup-placement.ts` both the
  structural and reached variants) and `agreedDue` in `acquisition-point-reached.ts`
  (today host+rewardType without phase; must read `dueContactMatches` and keep
  the current effective behaviour, documented if the phase was deliberately
  ignored).
- Due spawn (`spawned-trait-offers.ts`).
- Lifecycle consumption (`lifecycle/execute.ts` reference phase check).
- Edit settlement (`edit-settlement.ts` `purchasedObligation`, prior/incompatible,
  `corresponds`): compare obligations, not stringified purchase JSON.
- Authored domain/state (`room-actions/domain.ts`, `room-actions/state.ts`,
  `commands/acquisition/acquisition-site.ts`, `commands/room-actions.ts`,
  `commands/occurrence/dispatch.ts`): use the shared predicates.
- Execution assembly (`execution-plan/assembly/overview.ts`, `timeline-transactions.ts`)
  reads host/phase from the obligation; wire output unchanged.
- Candidate artifacts and the application's row projection keep their current
  inputs; if the obligation can replace an app-side recomputation
  (`occurrence-action-row-projection.ts` ~592-600) note it for a follow-up, do not
  touch the app here.

## Gates

1. `refactor(engine): introduce the Hermes delivery obligation product` — type,
   scheduler, countdown, flush, publication, shared predicates; consumers
   adapted only where the state shape forces it.
2. `refactor(engine): read Hermes due contacts from the obligation` — frontier,
   assessment, spawn, consumption, settlement, authored domain and commands,
   execution assembly; delete the predicate copies and dead code.
3. Closure: `docs/design/ROOM_LIFECYCLE_MODEL.md` and
   `SIMULATION_AND_VALIDATION.md` name the obligation as the single due-contact
   owner; architecture test forbids `slice('initial:'.length)` and
   `kind === 'Preboss'` delivery predicates outside the owning module; delete
   this plan.

## Tests

Primary owners unchanged: `hermes-shrine-inventory.test.ts` (scheduler,
countdown, flush, spawn), `hermes-shrine-delivery.test.ts` (commands, domain),
`edit-settlement/timed-effects.test.ts` (settlement predicates),
`generated-pickup-placement.test.ts` (assessment). Add one unit test file for
the shared predicates and `dueContactMatches`. Equivalence lane after each gate:
unchanged baseline is the acceptance; any digest change stops the gate.

## Non-goals

Lua/module changes, protocol fields, new findings, changing which rooms or
encounters tick, the eight-way predicate list in the application lane.
