import type { RewardBranchState } from './rewards/branch-primitives';

/** Banks an already-awarded semantic Path selection for the next writable screen. */
export function bankPathPoints(branch: RewardBranchState, points: number): RewardBranchState {
  if (points === 0) return branch;
  return Object.freeze({
    ...branch,
    hexProgress: Object.freeze({
      ...branch.hexProgress,
      bankedPathPoints: branch.hexProgress.bankedPathPoints + points,
    }),
  });
}

/**
 * This supported baseline has no tree-capacity model: a reached Path screen
 * invests its full declared grant plus every already-banked selection.
 */
export function settlePathScreen(branch: RewardBranchState, points: 1 | 3 | 5): RewardBranchState {
  const total = branch.hexProgress.bankedPathPoints + points;
  return Object.freeze({
    ...branch,
    hexProgress: Object.freeze({
      bankedPathPoints: 0,
      investedPathPoints: branch.hexProgress.investedPathPoints + total,
    }),
  });
}
