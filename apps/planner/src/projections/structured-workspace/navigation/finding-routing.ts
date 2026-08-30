import {
  createBiomeAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceInspectorDestination,
  type WorkspaceRoute,
} from '../contract';

/**
 * Fine-grained findings identify an authored leaf or structural control. They
 * may redirect into a containing workbench, but cannot use a biome fallback.
 */
export function isFineGrainedFindingOwner(address: SemanticAddress): boolean {
  switch (address.kind) {
    case 'batchRewardStore':
    case 'exitSelection':
    case 'target':
    case 'occurrence':
    case 'incomingReward':
    case 'localReward':
    case 'roomAction':
    case 'localVisitDecision':
    case 'localVisitSlot':
    case 'localVisitOrder':
    case 'rewardWheel':
    case 'rewardWheelOffer':
    case 'hubSlot':
    case 'hubVisit':
    case 'shopOffer':
    case 'encounterPhase':
    case 'gorgonPhase':
    case 'traitOffer':
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'echoLastRunBoon':
    case 'echoLastReward':
    case 'allTogetherSet':
    case 'levelResolution':
    case 'judgmentArcana':
    case 'acquisitionSite':
    case 'acquisitionEntry':
    case 'steadyGrowthOutcome':
    case 'transcendentEmbryoOutcome':
    case 'fountainRarityOutcome':
      return true;
    case 'keepsakeEquipResult':
      return (
        address.selection.kind === 'echoKeepsakeReplay' || address.selection.owner !== 'routeStart'
      );
    case 'echoKeepsakeReplay':
      return true;
    default:
      return false;
  }
}

/**
 * A fine-grained finding reaches this point only after final presentation has
 * bound its exact semantic owner. Unlike a coarse finding, it must resolve to
 * the structural node selected for that owner rather than inheriting a default
 * inspector subject.
 */
export function assertFineGrainedFindingDestination(
  origin: SemanticAddress,
  destination: WorkspaceInspectorDestination | undefined,
  route: WorkspaceRoute,
): void {
  const key = semanticAddressKey(origin);
  if (destination === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${key} finding has no exact workspace destination`,
    );
  }
  const exactNode =
    destination?.routeKey === undefined || destination.biomeKey === undefined
      ? undefined
      : route.routeKey !== destination.routeKey
        ? undefined
        : route.biomes
            .find((biome) => biome.biomeKey === destination.biomeKey)
            ?.nodes.find((node) => node.key === destination.nodeKey);
  const exactFrontier =
    destination?.routeKey === undefined ||
    destination.biomeKey === undefined ||
    destination.inspectorSubject?.kind !== 'frontier'
      ? undefined
      : route.routeKey !== destination.routeKey
        ? false
        : route.biomes.find((biome) => biome.biomeKey === destination.biomeKey)?.frontier?.marker
            .focusKey === destination.inspectorSubject.frontierFocusKey;
  if (
    semanticAddressKey(destination.ownerAddress) !== key ||
    destination.region !== 'structure' ||
    !(
      (destination.inspectorSubject?.kind === 'node' &&
        destination.inspectorSubject.nodeKey === destination.nodeKey &&
        exactNode !== undefined) ||
      exactFrontier === true
    )
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${key} finding has no exact workspace inspector destination`,
    );
  }
}

function assertFindingDestination(
  origin: SemanticAddress,
  destination: WorkspaceInspectorDestination | undefined,
): void {
  const key = semanticAddressKey(origin);
  if (destination === undefined || semanticAddressKey(destination.ownerAddress) !== key) {
    throw new StructuredWorkspaceProjectionContractError(
      `${key} finding has no exact workspace destination`,
    );
  }
}

/**
 * Findings are routed only after the selected route has published its final
 * inspector destinations. Every live finding must retain an exact destination;
 * coarse owners may inherit their biome shell while fine-grained owners are
 * verified above and never acquire that fallback.
 */
export function registerWorkspaceFindingDestinations(
  findings: readonly SemanticFinding[],
  focusByOwner: Map<string, WorkspaceInspectorDestination>,
  route: WorkspaceRoute,
): void {
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    const existing = focusByOwner.get(key);
    if (isFineGrainedFindingOwner(finding.origin)) {
      assertFineGrainedFindingDestination(finding.origin, existing, route);
      continue;
    }
    if (existing !== undefined) {
      assertFindingDestination(finding.origin, existing);
      continue;
    }
    if (!('routeKey' in finding.origin) || !('biomeKey' in finding.origin)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} finding has no exact workspace destination`,
      );
    }
    const biome = createBiomeAddress(finding.origin.routeKey, finding.origin.biomeKey);
    const fallback = focusByOwner.get(semanticAddressKey(biome));
    if (fallback === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} finding has no exact workspace destination`,
      );
    }
    // A coarse finding uses the biome's inspector fallback, but it is still an
    // explicit owner. Do not inherit a no-focus rail selection from the biome
    // shell (notably its active start frontier).
    const destination = Object.freeze({
      ...(fallback.biomeKey === undefined ? {} : { biomeKey: fallback.biomeKey }),
      focusAddress: fallback.focusAddress,
      focusKey: fallback.focusKey,
      ...(fallback.inspectorSubject === undefined
        ? {}
        : { inspectorSubject: fallback.inspectorSubject }),
      nodeKey: fallback.nodeKey,
      ownerAddress: finding.origin,
      region: fallback.region,
      ...(fallback.routeKey === undefined ? {} : { routeKey: fallback.routeKey }),
    });
    focusByOwner.set(key, destination);
    assertFindingDestination(finding.origin, destination);
  }
}
