import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../../authored-project/addresses';
import { createUnresolvedAcquisitionRewardState } from '../../../../authored-project/traits/state';
import type { ResolvedRewardOffer } from '../../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { CanonicalLocalReward } from '../../../materialization';
import { settleOwnedAcquisitionSite } from '../../acquisition/site-settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, mergeRewardFindingEmissions, rewardFinding } from '../../findings';
import { processRewardOffer, type OfferProcessingPeer } from '../../offer-generation';
import { localRewardBinding } from '../room-reward-bindings';
import {
  createRewardProducerCandidateResult,
  type RewardProducerFrontier,
} from '../../producer-frontiers';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import type { RewardLifecycleReferences } from '../prepared-inputs';
import { createGenerationEmissions, type GenerationEmissions } from './emissions';
import { historyFindingChronology, rewardFindingChronologyForRoom } from '../finding-chronology';
import type { RoomCreatedRewardContext } from './room-created-context';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { SimulationState } from '../../../state/model';

function localCandidateForOffer(
  catalog: Catalog,
  localReward: CanonicalLocalReward,
  offer: ResolvedRewardOffer,
): CanonicalLocalReward {
  if (JSON.stringify(localReward.offer) === JSON.stringify(offer)) return localReward;
  const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'producerLifecycle',
    key: localReward.producerLifecycleKey,
  });
  return Object.freeze({
    ...localReward,
    ...state,
    traitContext: Object.freeze({
      ...localReward.traitContext,
      devotionNoDuo: offer.rewardType === 'Devotion',
    }),
  });
}

function localAcquisition(
  context: RoomCreatedRewardContext,
  views: ProgressiveRoomHistoryViews | undefined,
  lifecycle: RewardLifecycleReferences,
  slotKey: string,
  phaseKey: string,
) {
  const ownerKey = semanticAddressKey(context.room.origin);
  const event =
    context.room.lifecycleProfileKey === 'FieldsCombatRoom'
      ? lifecycle.acquisitionPointsByOwner
          .get(ownerKey)
          ?.find((point) => point.point === `cages:${slotKey}`)
      : lifecycle.encounterCompletionsByOwner
          .get(ownerKey)
          ?.find((point) => point.phaseKey === phaseKey);
  const view =
    context.room.lifecycleProfileKey === 'FieldsCombatRoom'
      ? views?.acquisitionPoints?.find((point) => point.point === `cages:${slotKey}`)?.before
      : (views?.preOutgoing ?? views?.entry);
  return Object.freeze({ event, view });
}

/** Generates ordered local rewards, stopping at the first unresolved local slot. */
export function generateLocalRewards(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  event: Extract<HistoryEvent, { readonly kind: 'roomCreated' }>,
  context: RoomCreatedRewardContext,
  inputs: {
    readonly branches: readonly RewardBranchState[];
    readonly peers: readonly OfferProcessingPeer[];
    readonly views: ProgressiveRoomHistoryViews | undefined;
    readonly lifecycle: RewardLifecycleReferences;
    readonly enteredBiomeCount: number;
    readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  },
): GenerationEmissions {
  let branches = inputs.branches;
  let peers = inputs.peers;
  const findings = new Map<string, FindingRegionEntry>();
  const producerFrontiers: RewardProducerFrontier[] = [];
  for (const localReward of context.localRewards) {
    const frontierBranches = branches;
    const chronology =
      event.source === 'localVisit'
        ? rewardFindingChronologyForRoom(
            snapshot,
            context.room.origin,
            event.sequence,
            'localRoomLifecycle',
          )
        : undefined;
    const acquisition = localAcquisition(
      context,
      inputs.views,
      inputs.lifecycle,
      localReward.slotKey,
      localReward.encounterPhaseKey,
    );
    const ownerKey = semanticAddressKey(localReward.origin);
    const offerContext = Object.freeze({
      catalog,
      reward: localReward,
      binding: localRewardBinding(context.declaration, localReward),
      historySequence: event.sequence,
      ...(chronology === undefined ? {} : { findingChronology: chronology }),
      peers,
      facts: (state: SimulationState) =>
        createBiomeRewardFacts({
          catalog,
          state,
          source: context.source,
          currentRoom: context.currentRoom,
          sourceDeclaration: context.sourceDeclaration,
          view: context.generationView!,
          currentRoomShopOptionNames: context.currentShopNames,
          hubBoardLookups: 'notConsulted',
        }),
    });
    producerFrontiers.push(
      Object.freeze({
        generationPolicy: 'sequential',
        generationHistorySequence: event.sequence,
        reachableBranchCount: frontierBranches.length,
        acquisitionHorizon:
          acquisition.event === undefined || acquisition.view === undefined
            ? 'generationOnly'
            : 'ownEnteredLifecycle',
        owners: Object.freeze([localReward.origin]),
        resolvedStoreKey: localReward.resolvedStoreKey,
        evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
          if (semanticAddressKey(owner) !== ownerKey)
            throw new BiomeRewardSimulationContractError(
              'local reward frontier received a foreign owner',
            );
          const candidate = localCandidateForOffer(catalog, localReward, offer);
          const candidateContext = Object.freeze({ ...offerContext, reward: candidate });
          const candidateFindings = new Map<string, FindingRegionEntry>();
          const candidateBranches = processRewardOffer(
            frontierBranches,
            candidateContext,
            candidateFindings,
          );
          if (
            candidateBranches.length > 0 &&
            acquisition.event !== undefined &&
            acquisition.view !== undefined
          ) {
            const settlement = settleOwnedAcquisitionSite(
              catalog,
              candidateBranches,
              {
                siteOwner: localReward.origin,
                pointKey:
                  acquisition.event.kind === 'acquisitionPointReached'
                    ? acquisition.event.point
                    : candidate.encounterPhaseKey,
                entryKey: candidate.slotKey,
                source: Object.freeze({
                  ...candidate,
                  instanceProvenance: 'free',
                  presentsMaterializedScreen: true,
                }),
                historySequence: acquisition.event.sequence,
                authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
              },
              (state) =>
                createBiomeRewardFacts({
                  catalog,
                  state,
                  source: context.room,
                  currentRoom: context.room,
                  sourceDeclaration: context.declaration,
                  view: acquisition.view!,
                  hubBoardLookups: 'notConsulted',
                }),
              ownerRegion(localReward.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                context.room.origin,
                acquisition.event.sequence,
                'localRoomLifecycle',
              ),
            );
            mergeRewardFindingEmissions(candidateFindings, settlement.findingEmissions);
          }
          return createRewardProducerCandidateResult(candidateFindings, candidateBranches);
        },
      }),
    );
    branches = processRewardOffer(branches, offerContext, findings);
    peers = Object.freeze([
      ...peers,
      Object.freeze({ origin: localReward.origin, offer: localReward.offer }),
    ]);
  }
  const unresolved = context.unresolvedLocalReward;
  if (unresolved !== undefined && branches.length > 0) {
    const frontierBranches = branches;
    const ownerKey = semanticAddressKey(unresolved.origin);
    const acquisition = localAcquisition(
      context,
      inputs.views,
      inputs.lifecycle,
      unresolved.slotKey,
      unresolved.encounterPhaseKey,
    );
    producerFrontiers.push(
      Object.freeze({
        generationPolicy: 'sequential',
        generationHistorySequence: event.sequence,
        reachableBranchCount: frontierBranches.length,
        acquisitionHorizon:
          acquisition.event === undefined || acquisition.view === undefined
            ? 'generationOnly'
            : 'ownEnteredLifecycle',
        owners: Object.freeze([unresolved.origin]),
        resolvedStoreKey: unresolved.resolvedStoreKey,
        evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
          if (semanticAddressKey(owner) !== ownerKey)
            throw new BiomeRewardSimulationContractError(
              'unresolved local reward frontier received a foreign owner',
            );
          const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
            kind: 'producerLifecycle',
            key: unresolved.producerLifecycleKey,
          });
          const candidate = Object.freeze({
            ...unresolved,
            offer,
            traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
            ...(state.levelResolutionsByAcquisitionRole === undefined
              ? {}
              : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
            dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
            traitContext: Object.freeze({
              blockGiftBoons: context.declaration.blockGiftBoons,
              devotionNoDuo: offer.rewardType === 'Devotion',
            }),
          });
          const candidateFindings = new Map<string, FindingRegionEntry>();
          const candidateBranches = processRewardOffer(
            frontierBranches,
            Object.freeze({
              catalog,
              reward: candidate,
              binding: localRewardBinding(context.declaration, candidate),
              historySequence: event.sequence,
              peers,
              facts: (state: SimulationState) =>
                createBiomeRewardFacts({
                  catalog,
                  state,
                  source: context.source,
                  currentRoom: context.currentRoom,
                  sourceDeclaration: context.sourceDeclaration,
                  view: context.generationView!,
                  currentRoomShopOptionNames: context.currentShopNames,
                  hubBoardLookups: 'notConsulted',
                }),
            }),
            candidateFindings,
          );
          if (
            candidateBranches.length > 0 &&
            acquisition.event !== undefined &&
            acquisition.view !== undefined
          ) {
            const settlement = settleOwnedAcquisitionSite(
              catalog,
              candidateBranches,
              {
                siteOwner: candidate.origin,
                pointKey:
                  acquisition.event.kind === 'acquisitionPointReached'
                    ? acquisition.event.point
                    : candidate.encounterPhaseKey,
                entryKey: candidate.slotKey,
                source: Object.freeze({
                  ...candidate,
                  instanceProvenance: 'free',
                  presentsMaterializedScreen: true,
                }),
                historySequence: acquisition.event.sequence,
                authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
              },
              (state) =>
                createBiomeRewardFacts({
                  catalog,
                  state,
                  source: context.room,
                  currentRoom: context.room,
                  sourceDeclaration: context.declaration,
                  view: acquisition.view!,
                  hubBoardLookups: 'notConsulted',
                }),
              ownerRegion(candidate.origin),
            );
            mergeRewardFindingEmissions(candidateFindings, settlement.findingEmissions);
          }
          return Object.freeze({
            findings: Object.freeze(
              [...candidateFindings.values()]
                .map((entry) => entry.finding)
                .filter((finding) => finding.code !== 'traitOfferMissing'),
            ),
            supported: candidateBranches.length > 0,
          });
        },
      }),
    );
    addRewardFinding(
      findings,
      rewardFinding('rewardMissing', unresolved.origin, {}),
      ownerRegion(unresolved.origin),
      historyFindingChronology(event.sequence),
    );
    branches = Object.freeze([]);
  }
  return createGenerationEmissions(branches, peers, findings, producerFrontiers);
}
