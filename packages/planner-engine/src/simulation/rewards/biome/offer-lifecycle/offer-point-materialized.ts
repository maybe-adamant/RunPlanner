import { routeRoomDeclaration } from '../../../../authored-project/route-profile';
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
import type { FixedAcquisitionRealization } from '../../acquisition/contracts';
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
  readonly routeLoadout: RouteLoadout;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  readonly shipLifecycleCandidateAlreadyPublished: boolean;
}

export interface OfferPointMaterializedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly fixedAcquisitionRealizations: readonly FixedAcquisitionRealization[];
  readonly shipLifecycleCandidate?: ShipLifecycleCandidateContext;
}

/** Dispatches one reached offer point to its declaration-owned transition. */
export function applyOfferPointMaterializedTransition(
  inputs: OfferPointMaterializedTransitionInputs,
): OfferPointMaterializedTransition {
  const room = inputs.rooms.get(semanticAddressKey(inputs.event.origin));
  const declaration =
    room === undefined
      ? undefined
      : routeRoomDeclaration(inputs.catalog.rooms.byKey[room.gameName], room.origin.routeKey);
  const roomView = inputs.views.get(semanticAddressKey(inputs.event.origin));
  if (
    room === undefined ||
    room.kind !== 'authored' ||
    declaration === undefined ||
    roomView === undefined
  )
    throw new BiomeRewardSimulationContractError('shop offer point has no authored room');

  if (inputs.event.offerPoint === 'shopInventory')
    return Object.freeze({
      ...applyShopOfferPointMaterialization({
        catalog: inputs.catalog,
        snapshot: inputs.snapshot,
        event: inputs.event,
        room,
        declaration,
        roomView,
        branches: inputs.branches,
      }),
      fixedAcquisitionRealizations: Object.freeze([]),
    });

  if (inputs.event.offerPoint === 'fieldsOptionalRewards')
    return Object.freeze({
      ...materializeFieldsOptionalOfferPoint({
        catalog: inputs.catalog,
        snapshot: inputs.snapshot,
        event: inputs.event,
        room,
        declaration,
        roomView,
        branches: inputs.branches,
        lifecycle: inputs.lifecycle,
        authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
      }),
      fixedAcquisitionRealizations: Object.freeze([]),
    });

  const wheel = applyRewardWheelOfferPointMaterialization({
    catalog: inputs.catalog,
    event: inputs.event,
    room,
    declaration,
    roomView,
    lifecycle: inputs.lifecycle,
    branches: inputs.branches,
    routeLoadout: inputs.routeLoadout,
    authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
  });
  return Object.freeze({
    branches: wheel.branches,
    findings: wheel.findings,
    producerFrontiers: wheel.producerFrontiers,
    fixedAcquisitionRealizations: wheel.fixedAcquisitionRealizations,
    ...(inputs.shipLifecycleCandidateAlreadyPublished || wheel.shipLifecycleCandidate === undefined
      ? {}
      : { shipLifecycleCandidate: wheel.shipLifecycleCandidate }),
  });
}
