import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey } from '../../../../authored-project/addresses';
import type { RouteLoadout } from '../../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import type { FindingRegionEntry } from '../../../finding-regions';
import type { RewardBranchState } from '../../branch-primitives';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import type { ShipLifecycleCandidateContext } from '../../lifecycle-artifacts';
import type { RewardLifecycleReferences } from '../prepared-inputs';
import type { RewardProducerFrontier } from '../../producer-frontiers';
import { materializeFieldsOptionalOfferPoint } from './fields-optional-materialization';
import { applyRewardWheelOfferPointMaterialization } from './reward-wheel-offer-point-materialized';
import { applyShopOfferPointMaterialization } from './shop-offer-point-materialized';

export interface OfferPointMaterializedTransitionInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'offerPointMaterialized' }>;
  readonly rooms: ReadonlyMap<string, CanonicalAuthoredRoom | CanonicalHubRoom>;
  readonly views: ReadonlyMap<string, ProgressiveRoomHistoryViews>;
  readonly lifecycle: RewardLifecycleReferences;
  readonly branches: readonly RewardBranchState[];
  readonly enteredBiomeCount: number;
  readonly routeLoadout: RouteLoadout;
  readonly rewardLookups: Readonly<Record<string, ReadonlySet<string>>>;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  readonly shipLifecycleCandidateAlreadyPublished: boolean;
}

export interface OfferPointMaterializedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly shipLifecycleCandidate?: ShipLifecycleCandidateContext;
}

/** Dispatches one reached offer point to its declaration-owned transition. */
export function applyOfferPointMaterializedTransition(
  inputs: OfferPointMaterializedTransitionInputs,
): OfferPointMaterializedTransition {
  const room = inputs.rooms.get(semanticAddressKey(inputs.event.origin));
  const declaration = room === undefined ? undefined : inputs.catalog.rooms.byKey[room.gameName];
  const roomView = inputs.views.get(semanticAddressKey(inputs.event.origin));
  if (
    room === undefined ||
    room.kind !== 'authored' ||
    declaration === undefined ||
    roomView === undefined
  )
    throw new BiomeRewardSimulationContractError('shop offer point has no authored room');

  if (inputs.event.offerPoint === 'shopInventory')
    return applyShopOfferPointMaterialization({
      catalog: inputs.catalog,
      snapshot: inputs.snapshot,
      event: inputs.event,
      room,
      declaration,
      roomView,
      branches: inputs.branches,
      enteredBiomeCount: inputs.enteredBiomeCount,
      rewardLookups: inputs.rewardLookups,
    });

  if (inputs.event.offerPoint === 'fieldsOptionalRewards')
    return materializeFieldsOptionalOfferPoint({
      catalog: inputs.catalog,
      snapshot: inputs.snapshot,
      event: inputs.event,
      room,
      declaration,
      roomView,
      branches: inputs.branches,
      lifecycle: inputs.lifecycle,
      enteredBiomeCount: inputs.enteredBiomeCount,
      routeLoadout: inputs.routeLoadout,
      authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
    });

  const wheel = applyRewardWheelOfferPointMaterialization({
    catalog: inputs.catalog,
    event: inputs.event,
    room,
    declaration,
    roomView,
    lifecycle: inputs.lifecycle,
    branches: inputs.branches,
    enteredBiomeCount: inputs.enteredBiomeCount,
    routeLoadout: inputs.routeLoadout,
    authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
  });
  return Object.freeze({
    branches: wheel.branches,
    findings: wheel.findings,
    producerFrontiers: wheel.producerFrontiers,
    ...(inputs.shipLifecycleCandidateAlreadyPublished || wheel.shipLifecycleCandidate === undefined
      ? {}
      : { shipLifecycleCandidate: wheel.shipLifecycleCandidate }),
  });
}
