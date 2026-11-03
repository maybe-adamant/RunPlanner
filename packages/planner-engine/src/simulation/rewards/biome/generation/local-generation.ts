import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../../authored-project/addresses';
import { createUnresolvedAcquisitionRewardState } from '../../../../authored-project/traits/state';
import type { ResolvedRewardOffer } from '../../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import { forGeneration, type CanonicalLocalReward } from '../../../materialization';
import { settleOwnedAcquisitionSite } from '../../acquisition/site-settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, mergeRewardFindingEmissions, rewardFinding } from '../../findings';
import {
  countedStoreStanding,
  explainRewardOfferExclusions,
  processRewardOffer,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../offer-generation';
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
  const state = createUnresolvedAcquisitionRewardState(
    catalog,
    offer,
    {
      kind: 'producerLifecycle',
      key: localReward.producerLifecycleKey,
    },
    localReward.origin.routeKey,
  );
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
    readonly branch: RewardBranchState | undefined;
    readonly peers: readonly OfferProcessingPeer[];
    readonly views: ProgressiveRoomHistoryViews | undefined;
    readonly lifecycle: RewardLifecycleReferences;
    readonly enteredBiomeCount: number;
    readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  },
): GenerationEmissions {
  let branch = inputs.branch;
  let peers = inputs.peers;
  const findings = new Map<string, FindingRegionEntry>();
  const producerFrontiers: RewardProducerFrontier[] = [];
  for (const ownedReward of context.localRewards) {
    // A rerolled cage still offers its first draw; its acquisition is the effective reward's.
    const localReward = forGeneration(ownedReward);
    if (ownedReward.rerolledRewardMismatch === true)
      addRewardFinding(
        findings,
        rewardFinding('rerolledRewardMismatch', ownedReward.origin, {}),
        ownerRegion(ownedReward.origin),
        historyFindingChronology(event.sequence),
      );
    const frontier = branch;
    const chronology =
      event.source === 'localVisit'
        ? rewardFindingChronologyForRoom(
            snapshot,
            context.room.origin,
            event.sequence,
            'localRoomLifecycle',
          )
        : undefined;
    const acquisition =
      ownedReward.reroll === undefined
        ? localAcquisition(
            context,
            inputs.views,
            inputs.lifecycle,
            localReward.slotKey,
            localReward.encounterPhaseKey,
          )
        : Object.freeze({ event: undefined, view: undefined });
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
        acquisitionHorizon:
          acquisition.event === undefined || acquisition.view === undefined
            ? 'generationOnly'
            : 'ownEnteredLifecycle',
        owners: Object.freeze([localReward.origin]),
        resolvedStoreKey: localReward.resolvedStoreKey,
        evaluateOffer: (
          owner: SemanticAddress,
          offer: ResolvedRewardOffer,
          reachedThrough: number,
        ) => {
          if (semanticAddressKey(owner) !== ownerKey)
            throw new BiomeRewardSimulationContractError(
              'local reward frontier received a foreign owner',
            );
          const candidate = localCandidateForOffer(catalog, localReward, offer);
          const candidateContext = Object.freeze({ ...offerContext, reward: candidate });
          const candidateFindings = new Map<string, FindingRegionEntry>();
          const offered = processRewardOffer(frontier, candidateContext, candidateFindings);
          if (
            offered !== undefined &&
            acquisition.event !== undefined &&
            acquisition.event.sequence <= reachedThrough &&
            acquisition.view !== undefined
          ) {
            const settlement = settleOwnedAcquisitionSite(
              catalog,
              offered,
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
          return createRewardProducerCandidateResult(
            candidateFindings,
            offered,
            offered === undefined
              ? explainRewardOfferExclusions(frontier, candidateContext)
              : undefined,
            countedStoreStanding(frontier, candidateContext),
          );
        },
      }),
    );
    branch = processRewardOffer(branch, offerContext, findings);
    peers = Object.freeze([
      ...peers,
      Object.freeze({ origin: localReward.origin, offer: localReward.offer }),
    ]);
  }
  const unresolved = context.unresolvedLocalReward;
  if (unresolved !== undefined && branch !== undefined) {
    const frontier = branch;
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
        acquisitionHorizon:
          acquisition.event === undefined || acquisition.view === undefined
            ? 'generationOnly'
            : 'ownEnteredLifecycle',
        owners: Object.freeze([unresolved.origin]),
        resolvedStoreKey: unresolved.resolvedStoreKey,
        evaluateOffer: (
          owner: SemanticAddress,
          offer: ResolvedRewardOffer,
          reachedThrough: number,
        ) => {
          if (semanticAddressKey(owner) !== ownerKey)
            throw new BiomeRewardSimulationContractError(
              'unresolved local reward frontier received a foreign owner',
            );
          const state = createUnresolvedAcquisitionRewardState(
            catalog,
            offer,
            {
              kind: 'producerLifecycle',
              key: unresolved.producerLifecycleKey,
            },
            unresolved.origin.routeKey,
          );
          const candidate = Object.freeze({
            ...unresolved,
            offer,
            traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
            ...(state.levelResolutionsByAcquisitionRole === undefined
              ? {}
              : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
            ...(state.hexActivationsByAcquisitionRole === undefined
              ? {}
              : { hexActivationsByAcquisitionRole: state.hexActivationsByAcquisitionRole }),
            dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
            traitContext: Object.freeze({
              blockGiftBoons: context.declaration.blockGiftBoons,
              devotionNoDuo: offer.rewardType === 'Devotion',
            }),
          });
          const candidateFindings = new Map<string, FindingRegionEntry>();
          const candidateContext: OfferProcessingContext = Object.freeze({
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
          });
          const offered = processRewardOffer(frontier, candidateContext, candidateFindings);
          if (
            offered !== undefined &&
            acquisition.event !== undefined &&
            acquisition.event.sequence <= reachedThrough &&
            acquisition.view !== undefined
          ) {
            const settlement = settleOwnedAcquisitionSite(
              catalog,
              offered,
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
          const exclusions =
            offered === undefined
              ? explainRewardOfferExclusions(frontier, candidateContext)
              : undefined;
          const countedStore = countedStoreStanding(frontier, candidateContext);
          return Object.freeze({
            findings: Object.freeze(
              [...candidateFindings.values()]
                .map((entry) => entry.finding)
                .filter((finding) => finding.code !== 'traitOfferMissing'),
            ),
            supported: offered !== undefined,
            ...(exclusions === undefined ? {} : { exclusions }),
            ...(countedStore === undefined ? {} : { countedStore }),
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
    branch = undefined;
  }
  return createGenerationEmissions(branch, peers, findings, producerFrontiers);
}
