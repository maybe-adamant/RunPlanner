import {
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import type {
  CanonicalBiome,
  CanonicalDecision,
  MaterializedBiomePrefix,
  MaterializedHubVisitFrontier,
} from './materialization';
import {
  compareOwnerLocations,
  locateOwner,
  ownerOrigin,
  occurrenceOwnerAddress,
  type OwnerLocation,
} from './progressive/finding-location';

type BiomeMaterialization = CanonicalBiome | MaterializedBiomePrefix;

function hasHubVisitDetails(
  frontier: MaterializedBiomePrefix['frontier'] | undefined,
): frontier is MaterializedHubVisitFrontier {
  return frontier?.kind === 'hubVisit' && 'target' in frontier && 'localSlots' in frontier;
}

function biome(prefix: BiomeMaterialization): BiomeAddress {
  return createBiomeAddress(prefix.routeKey, prefix.biomeKey);
}

function decisions(prefix: BiomeMaterialization): readonly CanonicalDecision[] {
  if (prefix.kind !== 'biome' && prefix.frontier?.kind === 'exitDecision') {
    return prefix.frontier.partialBatch === undefined
      ? prefix.decisions
      : Object.freeze([...prefix.decisions, prefix.frontier.partialBatch]);
  }
  return prefix.decisions;
}

function normalTargetDecision(
  prefix: BiomeMaterialization,
  occurrenceId: string,
): SemanticAddress | undefined {
  const decision = decisions(prefix).find(
    (candidate) =>
      candidate.kind === 'batch' &&
      candidate.targets.some((target) => target.room.occurrenceId === occurrenceId),
  );
  if (decision?.kind === 'batch') return decision.origin;
  if (
    prefix.kind === 'biomePrefix' &&
    prefix.frontier?.kind === 'exitDecision' &&
    prefix.frontier.targets.some((target) => target.room.occurrenceId === occurrenceId)
  ) {
    return prefix.frontier.origin;
  }
  return undefined;
}

function hubRewardBoundary(
  prefix: BiomeMaterialization,
  occurrenceId: string,
): SemanticAddress | undefined {
  for (const decision of decisions(prefix)) {
    if (decision.kind !== 'hub') continue;
    if (decision.board.targets.some((target) => target.room.occurrenceId === occurrenceId)) {
      return decision.origin;
    }
    for (const visit of decision.visits) {
      if (visit.localSlots.some((slot) => slot.occurrenceId === occurrenceId)) {
        return createOccurrenceAddress(biome(prefix), visit.target.room.occurrenceId);
      }
    }
  }
  const frontier = prefix.kind === 'biomePrefix' ? prefix.frontier : undefined;
  if (!hasHubVisitDetails(frontier)) return undefined;
  if (frontier.target.room.occurrenceId === occurrenceId) {
    return createHubDecisionAddress(biome(prefix), frontier.origin.hubKey);
  }
  if (frontier.localSlots.some((slot) => slot.occurrenceId === occurrenceId)) {
    return createOccurrenceAddress(biome(prefix), frontier.target.room.occurrenceId);
  }
  return undefined;
}

function hubVisitBoundary(
  prefix: BiomeMaterialization,
  hubKey: string,
  visitIndex: number,
): SemanticAddress | undefined {
  for (const decision of decisions(prefix)) {
    if (decision.kind !== 'hub' || decision.origin.hubKey !== hubKey) continue;
    const visit = decision.visits[visitIndex - 1];
    if (visit !== undefined) {
      return createOccurrenceAddress(biome(prefix), visit.target.room.occurrenceId);
    }
  }
  const frontier = prefix.kind === 'biomePrefix' ? prefix.frontier : undefined;
  if (
    hasHubVisitDetails(frontier) &&
    frontier.origin.hubKey === hubKey &&
    frontier.origin.visitIndex === visitIndex
  ) {
    return createOccurrenceAddress(biome(prefix), frontier.target.room.occurrenceId);
  }
  return undefined;
}

/**
 * Collapses an exact authoring owner to the existing route boundary that owns
 * its edit permission. Exact target and timeline positions remain on the
 * progressive products and never enter this resolver's result.
 */
export function resolveAuthoringBoundary(
  prefix: BiomeMaterialization,
  address: SemanticAddress,
): SemanticAddress {
  const ownerBiome = biome(prefix);
  switch (address.kind) {
    case 'exitDecision':
      return address;
    case 'exitSelection':
    case 'batchRewardStore':
    case 'target':
      return createExitDecisionAddress(ownerBiome, address.source);
    case 'hubDecision':
    case 'hubSlot':
    case 'hubOpenSet':
    case 'hubRoom':
      return createHubDecisionAddress(ownerBiome, address.hubKey);
    case 'hubVisit':
      return (
        hubVisitBoundary(prefix, address.hubKey, address.visitIndex) ??
        createHubDecisionAddress(ownerBiome, address.hubKey)
      );
    case 'incomingReward':
      return (
        normalTargetDecision(prefix, address.occurrenceId) ??
        hubRewardBoundary(prefix, address.occurrenceId) ??
        createOccurrenceAddress(ownerBiome, address.occurrenceId)
      );
    case 'keepsakeEquipResult':
      if (
        address.selection.kind === 'keepsakeSelection' &&
        address.selection.owner !== 'routeStart'
      ) {
        return address.selection.owner;
      }
      return ownerBiome;
  }
  const occurrence =
    occurrenceOwnerAddress(address) ?? occurrenceOwnerAddress(ownerOrigin(address));
  if (occurrence !== undefined) return occurrence;
  if ('hubKey' in address && typeof address.hubKey === 'string') {
    return createHubDecisionAddress(ownerBiome, address.hubKey);
  }
  if (address.kind === 'biome' || address.kind === 'biomeField') return address;
  return ownerBiome;
}

function coarseLocation(location: OwnerLocation): OwnerLocation {
  return Object.freeze({
    decisionIndex: location.decisionIndex,
    ...(location.fixedRoomIndex === undefined ? {} : { fixedRoomIndex: location.fixedRoomIndex }),
    ...(location.hubVisitIndex === undefined ? {} : { hubVisitIndex: location.hubVisitIndex }),
    ...(location.hubVisitPhase === undefined ? {} : { hubVisitPhase: location.hubVisitPhase }),
    ...(location.hubLocalLifecycleIndex === undefined
      ? {}
      : { hubLocalLifecycleIndex: location.hubLocalLifecycleIndex }),
  });
}

function boundaryLocation(
  prefix: BiomeMaterialization,
  boundary: SemanticAddress,
): OwnerLocation | undefined {
  const location = locateOwner(prefix, boundary);
  if (location === undefined) return undefined;
  return coarseLocation(location);
}

/** Compares two already-normalized boundaries without exact child positions. */
export function authoringBoundaryReadiness(
  prefix: BiomeMaterialization,
  owner: SemanticAddress,
  blockedAfter: SemanticAddress,
  blockedAfterFallbackLocation?: OwnerLocation,
): 'editable' | 'locked' {
  if (semanticAddressKey(owner) === semanticAddressKey(blockedAfter)) return 'editable';
  const ownerLocation = boundaryLocation(prefix, owner);
  const blockedAfterLocation =
    boundaryLocation(prefix, blockedAfter) ??
    (blockedAfterFallbackLocation === undefined
      ? undefined
      : coarseLocation(blockedAfterFallbackLocation));
  if (ownerLocation === undefined || blockedAfterLocation === undefined) return 'locked';
  const comparison = compareOwnerLocations(ownerLocation, blockedAfterLocation);
  if (comparison < 0) return 'editable';
  if (comparison > 0) return 'locked';
  if (owner.kind === 'exitDecision' || owner.kind === 'hubDecision') {
    return blockedAfter.kind === 'occurrence' ? 'editable' : 'locked';
  }
  return 'locked';
}
