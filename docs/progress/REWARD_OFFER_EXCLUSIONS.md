# Reward Offer Exclusions

Status: locked 2026-10-20. Base commit: `fc751d1ff`.

## Objective

When a reward offer is impossible, the picker says why. The engine already
decides the cause while it generates offers; this exposes that decision as typed
evidence in one consistent shape across every reward-offer candidate kind, and
the planner turns it into copy. It is an explanation of existing work, not new
simulation, so it must not become a performance drag.

Today:

- door and local offers report one of three coarse finding codes, and
  `rewardBagEntryUnavailable` hides five causes;
- Shop and acquisition-entry offers hard-code `findings: []`;
- the reward wheel discards its per-trial findings.

The planner can therefore only say which roll cannot produce the item.

## Model

1. **Product.** `RewardProducerCandidateResult` gains
   `exclusions?: readonly RewardOfferExclusionEvidence[]`, present only when
   `supported === false`. Its shape:
   - a typed discriminated union modelled on `RoomGenerationExclusionEvidence`;
   - kinds and typed params only, never copy;
   - an `allBranches` flag per reason.
2. **First failing gate per branch.** Each reached branch records only the
   first gate that rejects the offer. The gates are already sequential, so this
   is free on the failure path. Later gates are not evaluated.
3. **Aggregation.**
   - Static causes hold in every branch and are the whole answer. These are:
     not in this store or Shop, a type fixed by the producer, excluded by the
     producer, and off this route.
   - Otherwise, take the union of each branch's first failing gate,
     de-duplicated by canonical key, and rank it by how many branches cite each
     reason, with a fixed kind precedence breaking ties.
   - Cap the result at 2 reasons.
   - Mark `allBranches` when a reason holds in every reached branch.
4. **Peer conflicts (wheel and Shop).** First check the focused item alone
   against the frontier. If it is supported alone, the reason is a peer
   conflict. Otherwise report the alone-cause, so the existential search stays
   unchanged.
5. **Requirement evidence.** Move `RequirementEvaluationEvidence` and its
   builder from `simulation/generation/target-policy.ts` into `requirements/` so
   the reward kernel and room generation share one requirement explanation.
6. **Inline.** Exclusions are computed in the candidate evaluation on the
   failure path only. Supported options pay nothing.
7. **Planner copy.**
   - One `rewardExclusionExplanation` switch runs ahead of the per-kind
     fallback in `explainCandidateEvaluation`, using the existing two-line cap.
   - A reason without `allBranches` reads as an alternative: "Depending on
     earlier rolls: …".
   - Requirement evidence reuses the existing room-requirement messages.

## Source facts

Gold is not modelled in offer generation; it belongs to purchase settlement. The
start room is a static declaration that the planner already explains. Neither is
in scope.

The cause inventory, with each kind's deciding site:

| Kind                                                           | Deciding site                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `notInStore`                                                   | `bag.ts` / `shop.ts`                                                     |
| `rewardTypeFixed`, `excludedByProducer`                        | `authored-site-settlement.ts`, `acquisition-point-reached.ts`            |
| `offRoute`                                                     | `bag.ts`                                                                 |
| `entryRequirement`                                             | `bag.ts`                                                                 |
| `entriesSpent`, `storeExhausted`                               | `bag.ts` / `offer-generation.ts`                                         |
| `priorityRequired`, `forcedReward`, `olympianProviderForced`   | `offer-generation.ts`                                                    |
| `godCap`, `godRequirement`, `godNotInteracted`                 | `support.ts`                                                             |
| `devotionSourceNotAcquired`                                    | `support.ts`                                                             |
| `peerConflict`                                                 | `support.ts`, `offer-generation.ts` priorOffers, `shop.ts` repeatedSlots |
| `shopOptionRequirement`, `shopExcluded`, `contractNotEquipped` | `shop.ts`, `shop-offer-point-materialized.ts`                            |

## Ownership

- **Planner engine:**
  - the exclusion union and the explaining variants of the gates (bag
    eligibility, `processRewardOffer`, `supportedPayloads`, the Shop option
    predicates);
  - aggregation;
  - wiring into every `evaluateOffer` capability;
  - the requirement-evidence move.
- **Planner application:** the copy switch, plus projection and UI witnesses.
- **No catalog, schema, plan-wire or game-module change.**

## Performance

- Before gate 1, capture `npm run test:performance:snapshot` at the base.
- After each engine gate, run `npm run test:performance:compare`; a failing
  verdict blocks the gate.
- If inline cost fails the comparison, stop and choose between narrowing the
  explanation and a lazy explain query. Don't loosen the thresholds.

## Probe: validation findings

During gate 1, attach the same exclusions to the evidence of the existing
reward-offer findings (`rewardBagEntryUnavailable`, `rewardBagSupportEmpty`,
`rewardSourceUnavailable`) and run `npm run test:equivalence`:

- if the `simulateProject` digest is unchanged, the refinement is included;
- if it moves, it is deferred and removed before the gate closes.

Candidate-probe digest moves for invalid probes are the intended product
change.

## Record-count audit

The game counts Devotion eligibility with `CountOf` over `LootTypeHistory`
(`LootData.lua` Devotion entry; `RequirementsLogic.lua` `CountOf` counts
distinct present keys), but `devotionLegal` declares `recordCount`, which sums
pickups. All 31 catalog `recordCount` declarations are audited against the
game's `CountOf` (distinct keys) or `SumOf` (total) before one catalog fix,
with a `schemaRevision` bump.

Copy that reads record-count evidence, to recheck after the fix:

- `apps/planner/src/projections/contextual/contextualOptions.ts`:
  `requirementMessages` record-count cases (`recordCount` /
  `distinctRecordKeyCount`) and the god-set "not counting Ares" rule.
- `apps/planner/src/projections/rewards/rewardPicker.ts`: the Trial type,
  chosen-god and specific-pair rows.
- `apps/planner/src/projections/structured-workspace/presentation/run-state.ts`:
  record-count requirement presentation.
- Tests: `apps/planner/test/projections/contextual/contextualOptions.test.ts`,
  `apps/planner/test/projections/rewards/rewardPicker.test.ts`.
- Owner copy table rows #35, #36, #37, #46, #47, #48 and #56.

## Gates

1. **Engine, static and door/local.**
   - the union, aggregation and `allBranches`;
   - the static short-circuits on every capability;
   - the door and local `processRewardOffer` and bag gates;
   - the god-support gates;
   - the requirement-evidence move;
   - the findings probe.

   Tests: `npm run test:engine`, `npm run test:equivalence` (baseline rewritten
   only for the intended candidate change) and the performance comparison.

2. **Engine, Shop and wheel.**
   - the Shop option predicates and the Contract rule;
   - the wheel and Shop peer-conflict split;
   - acquisition-entry producers.

   Same tests as gate 1.

3. **Planner copy.**
   - the exclusion switch and "Depending on earlier rolls";
   - witnesses, with `npm run test:planner`;
   - an owner copy review sheet;
   - the fallback hit count rerun; the per-kind fallback should approach zero.
4. **Closure.** An independent review of all gates, then delete this plan.

## Non-goals

- reporting every failing gate in a branch;
- a lazy explain query, unless the performance comparison forces it;
- gold or price reasons;
- start-room reasons.
