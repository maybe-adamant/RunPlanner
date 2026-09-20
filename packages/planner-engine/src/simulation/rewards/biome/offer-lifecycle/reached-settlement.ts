import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey } from '../../../../authored-project/addresses';
import { createAcquisitionRoleAddress } from '../../../../authored-project/addresses';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import { findingIdentityKey, ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { createBiomeRewardFacts } from '../../facts';
import { mergeRewardFindingEmissions } from '../../findings';
import type { RewardBranchState } from '../../branch-primitives';
import {
  settleOwnedAcquisitionSite,
  settleProducerAcquisitionSite,
  withStoredArtificerReplacements,
} from '../../acquisition/site-settlement';
import type { AcquisitionRoleFrontier } from '../../acquisition/contracts';
import { preparedAcquisitionSiteOwner } from '../prepared-inputs';
import type { ReachedTraitChildCheckpoint } from '../../trait-settlement/coordinator';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import { shipWheelRoomRewardSource } from './reward-wheel-lifecycle';
import type { SimulationState } from '../../../state/model';

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
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
}

/**
 * Settles one reached offer/acquisition lifecycle point.  The chronology
 * coordinator applies the immutable result at the event's original position.
 */
export function applyReachedOfferSettlement(
  inputs: ReachedOfferSettlementInputs,
): ReachedOfferSettlement {
  const { catalog, snapshot, event, rooms, views, branches } = inputs;
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
    const timelineOwner = room.roomActionRoster.rows.find(
      (candidate) =>
        !candidate.stale &&
        candidate.rank !== null &&
        candidate.reference.kind === 'interactWheelReward' &&
        candidate.reference.wheelKey === event.offerPoint,
    )?.owner;
    const settlement = settleOwnedAcquisitionSite(
      catalog,
      branches,
      {
        siteOwner: wheel.origin,
        pointKey: wheel.wheelKey,
        entryKey: 'picked',
        source: withStoredArtificerReplacements(room, shipWheelRoomRewardSource(wheel, picked)),
        ...(timelineOwner === undefined ? {} : { timelineOwner }),
        historySequence: event.sequence,
        deferArtificerReplacement: true,
        authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
      },
      (state) =>
        createBiomeRewardFacts({
          catalog,
          state,
          source: room,
          currentRoom: room,
          sourceDeclaration: declaration,
          view,
          hubBoardLookups: 'notConsulted',
        }),
      ownerRegion(wheel.origin),
    );
    mergeRewardFindingEmissions(findings, settlement.findingEmissions);
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
  const producerFacts = (state: SimulationState) =>
    createBiomeRewardFacts({
      catalog,
      state,
      source: room,
      currentRoom: room,
      sourceDeclaration: declaration,
      view: roomView.preOutgoing ?? roomView.entry,
      hubBoardLookups: 'notConsulted',
    });
  const timelineOwner =
    room.incomingReward === undefined
      ? undefined
      : createAcquisitionRoleAddress(room.incomingReward.origin, event.role);
  const settlement = settleProducerAcquisitionSite(
    catalog,
    branches,
    room,
    event,
    producerFacts,
    (detail) => {
      throw new BiomeRewardSimulationContractError(detail);
    },
    ownerRegion(room.incomingReward?.origin ?? room.origin),
    rewardFindingChronologyForRoom(snapshot, room.origin, event.sequence, 'localRoomLifecycle'),
    preparedAcquisitionSiteOwner(snapshot, room),
    inputs.authoredSeaStarDuplicateSiteKeys,
    timelineOwner,
  );
  mergeRewardFindingEmissions(findings, settlement.findingEmissions);
  return Object.freeze({
    branches: settlement.branches,
    findings: changedFindings(),
    roleFrontiers: Object.freeze(settlement.roleFrontiers ?? []),
    traitChildSettlements: Object.freeze(settlement.traitChildSettlements ?? []),
    traitChildOccurrenceOwner: room.origin,
  });
}
