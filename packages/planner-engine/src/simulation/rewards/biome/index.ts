import type { Catalog } from '../../../catalog-schema';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import type { RewardBranch, BiomeRewardSimulation } from '../model';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
import { evaluateBiomeRewardChronology } from './chronology';
import type { BiomeRewardEvaluationAssembly } from './publication';
import type { SemanticFinding } from '../../model';

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
  routePosition: ResolvedRoutePosition,
  routeLoadout: RouteLoadout,
  initialBranches: readonly RewardBranch[] | undefined = undefined,
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
  resourceFindings: readonly SemanticFinding[] = [],
  carriedRewardLookups: Readonly<Record<string, readonly string[]>> | undefined = undefined,
): BiomeRewardEvaluationAssembly {
  return evaluateBiomeRewardChronology(
    catalog,
    snapshot,
    history,
    routePosition,
    routeLoadout,
    initialBranches,
    resourcePlacements,
    resourceFindings,
    carriedRewardLookups,
  );
}

export function evaluateBiomeRewards(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  routePosition: ResolvedRoutePosition,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    routePosition,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}

export function evaluateBiomeRewardsAssembly(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  routePosition: ResolvedRoutePosition,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssemblyInternal(
    catalog,
    snapshot,
    history,
    routePosition,
    routeLoadout,
    initialBranches,
    resourcePlacements,
  ).simulation;
}
