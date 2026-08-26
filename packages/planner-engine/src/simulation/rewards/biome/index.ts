import type { Catalog } from '../../../catalog-schema';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import type { RewardBranch, BiomeRewardSimulation } from '../model';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
import { evaluateBiomeRewardChronology } from './chronology';
import type { BiomeRewardEvaluationAssembly } from './publication';

export type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
export type {
  TraitChildSettlementCheckpoint,
  TraitChildSettlementCheckpoints,
} from './publication';
export { BiomeRewardSimulationContractError } from './biome-contract';

/** The supported internal contact used by project evaluation composition. */
export function evaluateBiomeRewardsAssemblyInternal(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches: readonly RewardBranch[] | undefined = undefined,
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardEvaluationAssembly {
  return evaluateBiomeRewardChronology(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  );
}

export function evaluateBiomeRewards(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}

export function evaluateBiomeRewardsAssembly(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}
