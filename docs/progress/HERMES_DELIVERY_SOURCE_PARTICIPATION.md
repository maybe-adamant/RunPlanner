# Hermes delivery source participation

Status: locked 2026-10-02. Base: `fcda94ee`. Scope is the structural slice of
`docs/investigations/CROSS_ROOM_REQUIRED_PICKUP_REPAIR.md`; the evaluated
liveness question stays open in that investigation.

## Objective

A retained Shrine of Hermes delivery whose source occurrence can no longer be
entered in the authored topology must become a structurally stale row with the
ordinary removal proposal, and `RemoveRoomAction` must accept it. A delivery
whose source is structurally entered stays required and keeps its reward editor.

## Reproduction

A Surface project holds two `initial:*` deliveries in a later combat room from
purchases in an Ephyra side room. The side room's local-visit slot is later set
to `notGenerated` (or removed from `visitOrder`). The purchases remain stored,
so the host domain still reports both deliveries `required`; simulation reports
`rewardSourceUnavailable / staleHermesShrineDelivery`; removal fails with
`active required room action cannot be removed`.

## Facts and chosen rule

- `structurallyActiveOccurrenceIds(topology)` is the existing authored authority
  for "this occurrence is entered in the authored topology": start occurrence,
  selected exits, open hub slots, local-visit targets that are `generated` and
  listed in `visitOrder`, fixed links. The removal guard already applies it to
  the host occurrence. It does not consult simulation.
- Rule: a `hermesShrineDelivery` reference contributes to a host domain only
  while its source occurrence is structurally active in the source biome's
  topology. An inactive source yields no contribution, so assembly marks the row
  `stale` (existing `simulation/room-actions/assemble.ts` path), the existing
  removal proposal appears, and the guard no longer sees a required entry.
- Delta rule: `retractMissingHermesShrineDeliveryActions` also retracts
  deliveries whose Shrine source was structurally active before the command and
  is not after it. Restoring the source (re-enabling generation or re-adding the
  visit) lets `reconcileNewRequiredRoomActions` place the still-stored purchases
  again, as it does today for a new purchase.
- Not in scope: sources that are structurally active but contextually dead
  (timing, host phase, route moves). Those need the evaluated liveness product
  the investigation describes. No persisted stale flag, no load-time mutation,
  no schema change, no change to ordinary required-action protection.

## Ownership

Planner engine, `authored-project`:

- `hermes-shrine-delivery.ts`: one query answering whether a parsed delivery's
  source occurrence is structurally active in the document, built on
  `structurallyActiveOccurrenceIds`; the extended retraction.
- `room-actions/domain.ts`: `assembleRoomActionDomain` takes the set of inactive
  Hermes delivery source addresses (or an equivalent narrow input) and omits the
  contribution for a matching reference. Same-room deliveries are unaffected
  because the host is the source.
- `room-actions/defaults.ts` (`roomActionDomainContext`, `activeDomains`),
  `commands/room-actions.ts`, `commands/keepsake.ts`, `commands/judgment-arcana.ts`,
  `commands/figurine-arcana.ts`, and `simulation/materialization/rooms/assemble.ts`
  supply that input from the document. One helper computes it per document;
  callers do not re-derive the rule.

Application: no production change expected. The stale row already hides payload
controls and offers removal through `occurrence-action-row-projection.ts`.

## Tests

Primary owner: `packages/planner-engine/test/authored-project/commands/hermes-shrine-delivery.test.ts`
(extend; new sibling file only if it grows unwieldy), built from
`createEnteredNLocalProject`:

- source side room set `notGenerated` after purchase: both deliveries retract
  in the same command; purchases remain; re-enabling generation re-places them.
- document loaded with a stored inactive source and retained deliveries (encode
  the stale state directly): host domain has no contribution for them, assembly
  marks them `stale` with a removal proposal, `RemoveRoomAction` succeeds, Undo
  restores them, simulation no longer reports the two findings.
- source removed from `visitOrder` behaves the same as `notGenerated`.
- cross-biome delivery (N source, later-biome host) with inactive source.
- source still active: delivery stays `required`, removal still fails, reward
  editor context retained.
- ordinary required actions and same-room rushed deliveries: guard unchanged.

Representative witness in `apps/planner/test` only if an existing room-action
projection test can take one stale Hermes row cheaply; otherwise none.
Equivalence lane before and after (`npm run test:equivalence`); the baseline
must not change, since no corpus entry holds an inactive Shrine source.

## Gates

1. `fix(engine): retire Hermes deliveries whose source is structurally inactive`.
2. Closure: delete this plan; trim the investigation to the evaluated-liveness
   question; state the rule in one sentence in the Hermes Shrine delivery
   section of `docs/design/REWARD_MODEL.md`.
