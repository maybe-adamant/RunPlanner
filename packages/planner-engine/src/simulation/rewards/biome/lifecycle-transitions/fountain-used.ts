import type { Catalog } from '../../../../catalog-schema';
import {
  createFountainRarityOutcomeAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import { ownerRegion } from '../../../finding-regions';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { assessPhialTraitTargets, consumePhial } from '../../../keepsakes';
import {
  attachTraitHistory,
  createTraitHistoryState,
  settleFountainRarityMutation,
} from '../../../traits';
import { advanceRewardBranches } from '../../processing';
import type { RewardBranchState } from '../../branch-primitives';
import { rewardFinding } from '../../findings';
import type { FountainRarityCandidateCapability } from '../../../candidate-artifacts';
import type { LifecycleFinding } from './types';

export interface FountainUsedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly candidate?: {
    readonly key: string;
    readonly value: FountainRarityCandidateCapability;
  };
  readonly findings: readonly LifecycleFinding[];
}

/** Resolves the one occurrence-owned Phial use, immediately before later actions. */
export function applyFountainUsedTransition(
  catalog: Catalog,
  event: Extract<import('../../../history').HistoryEvent, { readonly kind: 'fountainUsed' }>,
  room: CanonicalAuthoredRoom | undefined,
  branches: readonly RewardBranchState[],
): FountainUsedTransition {
  const outcome = createFountainRarityOutcomeAddress(event.owner);
  const frontiers = branches.map((branch) => {
    const targets = assessPhialTraitTargets(
      catalog,
      branch.traitHistory ?? createTraitHistoryState(),
    );
    return Object.freeze({
      status: branch.keepsakes.phial?.status,
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
  if (
    room === undefined ||
    event.origin.kind !== 'occurrence' ||
    room.fountainRarityResult === undefined
  ) {
    if (!needsTarget && !hasConsumptionGuard)
      return Object.freeze({
        branches: advanceRewardBranches(branches, event.sequence),
        candidate,
        findings: Object.freeze([]),
      });
  }
  if (needsTarget && room?.fountainRarityResult === undefined) {
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
    });
  }
  const targetTraitKey = room?.fountainRarityResult?.targetTraitKey;
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
    });
  }
  const nextBranches = branches.map((branch) => {
    const frontier = assessPhialTraitTargets(
      catalog,
      branch.traitHistory ?? createTraitHistoryState(),
    );
    if (branch.keepsakes.phial?.status !== 'pending') return branch;
    if (frontier.consumptionTargetKeys.length === 0) return branch;
    if (frontier.mutationTargetKeys.length === 0)
      return Object.freeze({ ...branch, keepsakes: consumePhial(branch.keepsakes) });
    const before = branch.traitHistory ?? createTraitHistoryState();
    const settled = settleFountainRarityMutation(
      catalog,
      before,
      outcome,
      event.sequence,
      targetTraitKey!,
    );
    if (!settled.legal) return branch;
    return Object.freeze({
      ...branch,
      history: attachTraitHistory(branch.history, settled.history),
      traitHistory: settled.history,
      keepsakes: consumePhial(branch.keepsakes),
    });
  });
  return Object.freeze({
    branches: advanceRewardBranches(Object.freeze(nextBranches), event.sequence),
    candidate,
    findings: Object.freeze([]),
  });
}
