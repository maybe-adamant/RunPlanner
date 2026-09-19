import type {
  AuthoredRewardState,
  AuthoredStartingRewardAcquisition,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import type { ResolvedRoutePosition } from '../route-context';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';

/** Whether this occurrence owns the route-level entry reward acquisition payload. */
export function isRouteStartIncomingReward(
  document: ProjectDocument,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
): boolean {
  const firstPlan = document.route.biomes[0];
  return (
    routePosition.isFirst &&
    firstPlan?.biomeKey === routePosition.biomeKey &&
    firstPlan.topology?.startOccurrenceId === occurrence.occurrenceId
  );
}

/**
 * Reconstitutes the one entry reward state from its route-owned offer and
 * occurrence-owned acquisition outcomes. A selected offer always requires
 * payload storage on the active entry start.
 */
export function composeStartingReward(
  offer: ResolvedRewardOffer | null,
  acquisition: AuthoredStartingRewardAcquisition | undefined,
): AuthoredRewardState | null {
  if (offer === null) return null;
  if (acquisition === undefined)
    throw new Error('route starting reward is missing its entry acquisition payload');
  return Object.freeze({ offer, ...acquisition });
}

export function routeStartIncomingReward(
  document: ProjectDocument,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
): AuthoredRewardState | null | undefined {
  if (!isRouteStartIncomingReward(document, routePosition, occurrence)) return undefined;
  return composeStartingReward(
    document.route.loadout.startingReward,
    occurrence.startingRewardAcquisition,
  );
}

export function startingRewardAcquisitionFrom(
  reward: AuthoredRewardState,
): AuthoredStartingRewardAcquisition {
  const { offer: _offer, ...acquisition } = reward;
  void _offer;
  return Object.freeze(acquisition);
}
