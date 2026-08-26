import type { Catalog } from '../../../catalog-schema';
import { semanticAddressKey } from '../../../authored-project/addresses';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../materialization';
import { findingIdentityKey, ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { createBiomeRewardFacts } from '../facts';
import type { RewardBranchState } from '../branch-primitives';
import type { RewardHistoryState } from '../../../reward-kernel';
import {
  settleOwnedAcquisitionSite,
  settleProducerAcquisitionSite,
  withStoredArtificerReplacements,
  type AcquisitionRoleFrontier,
} from '../acquisition-settlement';
import { preparedAcquisitionSiteOwner } from '../prepared-inputs';
import type { ReachedTraitChildCheckpoint } from '../trait-settlement';
import { BiomeRewardSimulationContractError } from '../biome-contract';

export interface ReachedOfferSettlement {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly roleFrontiers: readonly AcquisitionRoleFrontier[];
  readonly traitChildSettlements: readonly ReachedTraitChildCheckpoint[];
  readonly traitChildOccurrenceOwner: CanonicalAuthoredRoom['origin'];
}

export interface ReachedOfferSettlementInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<
    HistoryEvent,
    { readonly kind: 'offerPointAcquired' | 'producerRoleAdvanced' }
  >;
  readonly rooms: ReadonlyMap<string, CanonicalAuthoredRoom | CanonicalHubRoom>;
  readonly views: ReadonlyMap<string, ProgressiveRoomHistoryViews>;
  readonly branches: readonly RewardBranchState[];
  /** Existing chronology findings whose reached evaluations may be extended. */
  readonly priorFindings: readonly FindingRegionEntry[];
  readonly enteredBiomeCount: number;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
}

/**
 * Settles one reached offer/acquisition lifecycle point.  The chronology
 * coordinator applies the immutable result at the event's original position.
 */
export function applyReachedOfferSettlement(
  inputs: ReachedOfferSettlementInputs,
): ReachedOfferSettlement {
  const { catalog, snapshot, event, rooms, views, branches, enteredBiomeCount } = inputs;
  const priorFindings = new Map(
    inputs.priorFindings.map((entry) => [findingIdentityKey(entry.finding), entry] as const),
  );
  const findings = new Map(priorFindings);
  const changedFindings = (): readonly FindingRegionEntry[] =>
    Object.freeze(
      [...findings.entries()]
        .filter(([key, entry]) => priorFindings.get(key) !== entry)
        .map(([, entry]) => entry),
    );
  const room = rooms.get(semanticAddressKey(event.origin));
  const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
  const roomView = views.get(semanticAddressKey(event.origin));
  if (room === undefined || declaration === undefined || roomView === undefined)
    throw new BiomeRewardSimulationContractError(
      event.kind === 'offerPointAcquired'
        ? 'reward-wheel acquisition has no authored room'
        : 'producer role has no authored room',
    );

  if (event.kind === 'offerPointAcquired') {
    if (room.kind !== 'authored')
      throw new BiomeRewardSimulationContractError('reward-wheel acquisition has no authored room');
    const wheel = room.rewardWheels?.find((candidate) => candidate.wheelKey === event.offerPoint);
    const picked = wheel?.offers.find((offer) => offer.picked);
    const view = roomView.offerPoints?.find(
      (candidate) => candidate.offerPoint === event.offerPoint,
    )?.acquisitionBefore;
    if (wheel === undefined || picked === undefined || view === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} has no canonical ${event.offerPoint} acquisition`,
      );
    const settlement = settleOwnedAcquisitionSite(
      catalog,
      branches,
      {
        siteOwner: wheel.origin,
        pointKey: wheel.wheelKey,
        entryKey: 'picked',
        source: withStoredArtificerReplacements(
          room,
          Object.freeze({
            ...picked,
            producerLifecycleKey: wheel.producerLifecycleKey,
            instanceProvenance: 'free',
          }),
        ),
        historySequence: event.sequence,
        deferArtificerReplacement: true,
        authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
      },
      (branchHistory) =>
        createBiomeRewardFacts(
          catalog,
          room,
          room,
          declaration,
          view,
          branchHistory,
          enteredBiomeCount,
        ),
      findings,
      ownerRegion(wheel.origin),
    );
    return Object.freeze({
      branches: settlement.branches,
      findings: changedFindings(),
      roleFrontiers: Object.freeze(settlement.roleFrontiers ?? []),
      traitChildSettlements: Object.freeze(settlement.traitChildSettlements ?? []),
      traitChildOccurrenceOwner: room.origin,
    });
  }

  if (room.kind === 'hub')
    throw new BiomeRewardSimulationContractError('Hub room cannot advance a reward producer');
  const producerFacts = (branchHistory: RewardHistoryState) =>
    createBiomeRewardFacts(
      catalog,
      room,
      room,
      declaration,
      roomView.preOutgoing ?? roomView.entry,
      branchHistory,
      enteredBiomeCount,
    );
  const settlement = settleProducerAcquisitionSite(
    catalog,
    branches,
    room,
    event,
    producerFacts,
    findings,
    (detail) => {
      throw new BiomeRewardSimulationContractError(detail);
    },
    ownerRegion(room.incomingReward?.origin ?? room.origin),
    rewardFindingChronologyForRoom(snapshot, room.origin, event.sequence, 'localRoomLifecycle'),
    preparedAcquisitionSiteOwner(snapshot, room),
    inputs.authoredSeaStarDuplicateSiteKeys,
  );
  return Object.freeze({
    branches: settlement.branches,
    findings: changedFindings(),
    roleFrontiers: Object.freeze(settlement.roleFrontiers ?? []),
    traitChildSettlements: Object.freeze(settlement.traitChildSettlements ?? []),
    traitChildOccurrenceOwner: room.origin,
  });
}
