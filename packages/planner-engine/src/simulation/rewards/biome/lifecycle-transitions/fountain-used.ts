import {
  applyTraitOfferTransition,
  invalidatedTraitOffers,
} from '../offer-lifecycle/spawned-trait-offers';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import type { Catalog } from '../../../../catalog-schema';
import {
  createFountainRarityOutcomeAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../../../authored-project/addresses';
import { routePurgingPool } from '../../../../authored-project/route-profile';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { assessPurgingPool, type PurgingPoolAssessment } from '../../../commerce/purging-pool';
import { ownerRegion } from '../../../finding-regions';
import type { AuthoredFountainRarityResult } from '../../../../authored-project/model';
import { assessPhialTraitTargets, consumePhial } from '../../../keepsakes/trait-effects';
import { settleFountainRarityMutation } from '../../../traits';
import { advanceRewardBranches } from '../../branch-lifecycle';
import type { RewardBranchState } from '../../branch-primitives';
import { rewardFinding } from '../../findings';
import { type FountainRarityCandidateCapability } from '../../../keepsakes/candidate-artifacts';
import type { LifecycleFinding } from './types';
import type { PlannerTimelineFacts } from '../../../timeline-facts';

export interface FountainUsedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly candidate?: {
    readonly key: string;
    readonly value: FountainRarityCandidateCapability;
  };
  readonly findings: readonly LifecycleFinding[];
  readonly timelineFacts: PlannerTimelineFacts;
  /** The Purging Pool frontier this fountain unlocked, keyed by its room. */
  readonly purgingPoolAssessment?: {
    readonly key: string;
    readonly value: {
      readonly origin: OccurrenceAddress;
      readonly assessments: readonly PurgingPoolAssessment[];
    };
  };
}

type FountainUsedEvent = Extract<
  import('../../../history').HistoryEvent,
  { readonly kind: 'fountainUsed' }
>;

/** Resolves one occurrence- or Hub-owned fountain use, immediately before later actions. */
export function applyFountainUsedTransition(
  catalog: Catalog,
  event: FountainUsedEvent,
  result: AuthoredFountainRarityResult | undefined,
  branches: readonly RewardBranchState[],
  /** Undefined for a Hub-owned or non-authored fountain. */
  room: CanonicalAuthoredRoom | undefined,
): FountainUsedTransition {
  const used = resolveFountainUse(catalog, event, result, branches);
  // The fountain unlocks Postboss facilities. Capture the pool only after
  // its rarity effects settle, never from entry or an unresolved Phial.
  // A retained Pool on a route without one is never assessed, so its sales stay unavailable.
  if (room?.purgingPool?.interacted !== true) return used;
  const findings = [...used.findings];
  const chronology = () =>
    Object.freeze({
      kind: 'history' as const,
      sequence: event.sequence,
      boundary: 'after' as const,
    });
  if (routePurgingPool(catalog.rooms.byKey[room.gameName], room.origin.routeKey) === undefined) {
    findings.push(
      Object.freeze({
        finding: rewardFinding(
          'purgingPoolUnavailable',
          createRoomFeatureAddress(room.origin, { kind: 'purgingPoolInventory' }),
          { routeKey: room.origin.routeKey },
        ),
        region: ownerRegion(room.origin),
        chronology: chronology(),
      }),
    );
    return Object.freeze({ ...used, findings: Object.freeze(findings) });
  }
  if (used.branches.length === 0) return used;
  const pool = room.purgingPool;
  const assessments = Object.freeze(
    used.branches.map((branch) =>
      assessPurgingPool(catalog, pool, branch.state.traitHistory.equippedTraits),
    ),
  );
  for (const assessment of assessments) {
    for (const finding of assessment.findings)
      findings.push(
        Object.freeze({
          finding: rewardFinding(
            finding.code,
            createRoomFeatureAddress(
              room.origin,
              finding.slotKey === undefined
                ? { kind: 'purgingPoolInventory' }
                : { kind: 'purgingPoolOffer', slotKey: finding.slotKey },
            ),
            {
              ...finding.evidence,
              ...(finding.slotKey === undefined ? {} : { slotKey: finding.slotKey }),
            },
          ),
          region: ownerRegion(room.origin),
          chronology: chronology(),
        }),
      );
  }
  return Object.freeze({
    ...used,
    findings: Object.freeze(findings),
    purgingPoolAssessment: Object.freeze({
      key: semanticAddressKey(room.origin),
      value: Object.freeze({ origin: room.origin, assessments }),
    }),
  });
}

function resolveFountainUse(
  catalog: Catalog,
  event: FountainUsedEvent,
  result: AuthoredFountainRarityResult | undefined,
  branches: readonly RewardBranchState[],
): FountainUsedTransition {
  const outcome = createFountainRarityOutcomeAddress(event.owner);
  const timelineFacts: PlannerTimelineFacts = Object.freeze({
    nodes: Object.freeze([Object.freeze({ owner: event.owner, included: true })]),
    dependencies: Object.freeze([]),
  });
  const frontiers = branches.map((branch) => {
    const targets = assessPhialTraitTargets(catalog, branch.state.traitHistory);
    return Object.freeze({
      status: branch.state.keepsakes.phial?.status,
      consumptionTargetKeys: targets.consumptionTargetKeys,
      mutationTargetKeys: targets.mutationTargetKeys,
    });
  });
  const candidate = Object.freeze({
    key: semanticAddressKey(outcome),
    value: Object.freeze({ frontiers: Object.freeze(frontiers) }),
  });
  const eligibleTargetKeys = Object.freeze(
    [...new Set(frontiers.flatMap((frontier) => frontier.mutationTargetKeys))].sort(),
  );
  const needsTarget = frontiers.some(
    (frontier) => frontier.status === 'pending' && frontier.mutationTargetKeys.length > 0,
  );
  const hasConsumptionGuard = frontiers.some(
    (frontier) => frontier.status === 'pending' && frontier.consumptionTargetKeys.length > 0,
  );
  if (result === undefined) {
    if (!needsTarget && !hasConsumptionGuard)
      return Object.freeze({
        branches: advanceRewardBranches(branches, event.sequence),
        candidate,
        findings: Object.freeze([]),
        timelineFacts,
      });
  }
  if (needsTarget && result === undefined) {
    return Object.freeze({
      branches: Object.freeze([]),
      candidate,
      findings: Object.freeze([
        Object.freeze({
          finding: rewardFinding('fountainRarityResultMissing', outcome, {
            eligibleTargetKeys,
          }),
          region: ownerRegion(event.origin),
          chronology: Object.freeze({ kind: 'history', sequence: event.sequence, boundary: 'at' }),
        }),
      ]),
      timelineFacts,
    });
  }
  const targetTraitKey = result?.targetTraitKey;
  if (
    targetTraitKey !== undefined &&
    frontiers.some(
      (frontier) =>
        frontier.status === 'pending' &&
        frontier.mutationTargetKeys.length > 0 &&
        !frontier.mutationTargetKeys.includes(targetTraitKey),
    )
  ) {
    return Object.freeze({
      branches: Object.freeze([]),
      candidate,
      findings: Object.freeze([
        Object.freeze({
          finding: rewardFinding('fountainRarityResultUnavailable', outcome, {
            targetTraitKey,
            eligibleTargetKeys,
          }),
          region: ownerRegion(event.origin),
          chronology: Object.freeze({ kind: 'history', sequence: event.sequence, boundary: 'at' }),
        }),
      ]),
      timelineFacts,
    });
  }
  const invalidation = invalidatedTraitOffers(event.origin, 'fountainRarity');
  const nextBranches = branches.map((branch) => {
    const frontier = assessPhialTraitTargets(catalog, branch.state.traitHistory);
    if (branch.state.keepsakes.phial?.status !== 'pending') return branch;
    if (frontier.consumptionTargetKeys.length === 0) return branch;
    // A firing Phial runs `AddRarityToTraits`, clearing live loot options even
    // when no rarifiable trait can actually promote.
    const invalidate = (settled: RewardBranchState) =>
      invalidation === undefined ? settled : applyTraitOfferTransition(settled, invalidation);
    if (frontier.mutationTargetKeys.length === 0)
      return invalidate(
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            keepsakes: consumePhial(branch.state.keepsakes),
          }),
        }),
      );
    const before = branch.state.traitHistory;
    const settled = settleFountainRarityMutation(
      catalog,
      before,
      outcome,
      event.sequence,
      targetTraitKey!,
    );
    if (!settled.legal) return branch;
    return invalidate(
      Object.freeze({
        ...branch,
        state: replaceSimulationTraitHistory(
          Object.freeze({ ...branch.state, keepsakes: consumePhial(branch.state.keepsakes) }),
          settled.history,
        ),
      }),
    );
  });
  return Object.freeze({
    branches: advanceRewardBranches(Object.freeze(nextBranches), event.sequence),
    candidate,
    findings: Object.freeze([]),
    timelineFacts,
  });
}
