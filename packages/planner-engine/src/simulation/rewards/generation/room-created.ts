import type { Catalog } from '../../../catalog-schema';
import { semanticAddressKey } from '../../../authored-project/addresses';
import type { RouteLoadout } from '../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../history';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import type { RewardLifecycleReferences } from '../prepared-inputs';
import { advanceRewardBranches, type OfferProcessingPeer } from '../processing';
import type { RewardBranchState } from '../branch-primitives';
import type { GenerationEmissions, PendingHubBoardGeneration } from './emissions';
import { generateIncomingReward } from './incoming-generation';
import { generateLocalRewards } from './local-generation';
import { prepareRoomCreatedRewardContext } from './room-created-context';
import { prepareRoomCreatedPrelude, type RoomCreatedPrelude } from './room-created-prelude';

type ContextInputs = Parameters<typeof prepareRoomCreatedRewardContext>[2];
type PreludeRooms = Parameters<typeof prepareRoomCreatedPrelude>[2];
type PreludeViews = Parameters<typeof prepareRoomCreatedPrelude>[3];
type PreludeBatches = Parameters<typeof prepareRoomCreatedPrelude>[4];

export interface RoomCreatedTransitionInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'roomCreated' }>;
  readonly rooms: ContextInputs['rooms'] & PreludeRooms;
  readonly views: ReadonlyMap<string, ProgressiveRoomHistoryViews> & PreludeViews;
  readonly targets: ContextInputs['targets'];
  readonly hubTargetByOrigin: ContextInputs['hubTargetByOrigin'];
  readonly additionalContinuations: ContextInputs['additionalContinuations'];
  readonly expectedStores: ContextInputs['expectedStores'];
  readonly hermesShrineAssessments: ContextInputs['hermesShrineAssessments'];
  readonly batchesByParent: PreludeBatches;
  readonly historyCurrent?: NonNullable<ContextInputs['historyCurrent']>;
  readonly branches: readonly RewardBranchState[];
  readonly peers: readonly OfferProcessingPeer[];
  readonly pendingHubBoard?: PendingHubBoardGeneration;
  readonly lifecycle: RewardLifecycleReferences;
  readonly routeLoadout: RouteLoadout;
  readonly enteredBiomeCount: number;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
}

export interface RoomCreatedTransition extends GenerationEmissions, RoomCreatedPrelude {}

/**
 * Applies the complete room-created reward transition. The chronology owns
 * when this product is applied; all generation sequencing stays private here.
 */
export function applyRoomCreatedTransition(
  inputs: RoomCreatedTransitionInputs,
): RoomCreatedTransition {
  const {
    catalog,
    snapshot,
    event,
    rooms,
    views,
    batchesByParent,
    branches,
    peers,
    lifecycle,
    routeLoadout,
    enteredBiomeCount,
    authoredSeaStarDuplicateSiteKeys,
  } = inputs;
  const prelude = prepareRoomCreatedPrelude(
    catalog,
    event,
    rooms,
    views,
    batchesByParent,
    branches,
  );
  const contextResult = prepareRoomCreatedRewardContext(catalog, event, {
    rooms,
    views,
    targets: inputs.targets,
    hubTargetByOrigin: inputs.hubTargetByOrigin,
    additionalContinuations: inputs.additionalContinuations,
    expectedStores: inputs.expectedStores,
    hermesShrineAssessments: inputs.hermesShrineAssessments,
    ...(inputs.historyCurrent === undefined ? {} : { historyCurrent: inputs.historyCurrent }),
  });
  if (contextResult.kind !== 'reward')
    return Object.freeze({
      branches: advanceRewardBranches(branches, event.sequence),
      peers,
      findings: Object.freeze([]),
      producerFrontiers: Object.freeze([]),
      ...(inputs.pendingHubBoard === undefined ? {} : { pendingHubBoard: inputs.pendingHubBoard }),
      ...prelude,
    });

  const exactRoomViews = views.get(semanticAddressKey(contextResult.context.room.origin));
  const incoming = generateIncomingReward(catalog, snapshot, event, contextResult.context, {
    branches,
    peers,
    ...(inputs.pendingHubBoard === undefined ? {} : { pendingHubBoard: inputs.pendingHubBoard }),
    lifecycle,
    roomViews: exactRoomViews,
    routeLoadout,
    enteredBiomeCount,
    authoredSeaStarDuplicateSiteKeys,
  });
  const local = generateLocalRewards(catalog, snapshot, event, contextResult.context, {
    branches: incoming.branches,
    peers: incoming.peers,
    views: exactRoomViews,
    lifecycle,
    routeLoadout,
    enteredBiomeCount,
    authoredSeaStarDuplicateSiteKeys,
  });
  return Object.freeze({
    branches: local.branches,
    peers: local.peers,
    findings: Object.freeze([...incoming.findings, ...local.findings]),
    producerFrontiers: Object.freeze([...incoming.producerFrontiers, ...local.producerFrontiers]),
    ...(incoming.pendingHubBoard === undefined
      ? {}
      : { pendingHubBoard: incoming.pendingHubBoard }),
    ...prelude,
  });
}
