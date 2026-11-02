import type { RewardBranch } from '../../src/simulation/rewards/model';

/** The walk's reached state as a list for array assertions: empty when a block stopped it. */
export function reachedFrontier(simulation: {
  readonly frontier: RewardBranch | undefined;
}): readonly RewardBranch[] {
  return simulation.frontier === undefined ? [] : [simulation.frontier];
}
