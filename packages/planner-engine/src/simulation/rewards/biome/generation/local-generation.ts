import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../../authored-project/addresses';
import type { RouteLoadout } from '../../../../authored-project/model';
import { createUnresolvedAcquisitionRewardState } from '../../../../authored-project/traits';
import type { ResolvedRewardOffer, RewardHistoryState } from '../../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { CanonicalLocalReward } from '../../../materialization';
import { settleOwnedAcquisitionSite } from '../../acquisition-settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { createBiomeRewardFacts } from '../../facts';
import { rewardFinding } from '../../findings';
import { addRewardFinding } from '../../findings';
import {
  consumeOlympianProviderForReachedOffer,
  processRewardOffer,
  type OfferProcessingPeer,
} from '../../processing';
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
    readonly routeLoadout: RouteLoadout;
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
      facts: (
        history: RewardHistoryState,
        _shop: ReadonlySet<string> | undefined,
        branch: RewardBranchState | undefined,
      ) =>
        createBiomeRewardFacts(
          catalog,
          context.source,
          context.currentRoom,
          context.sourceDeclaration,
          context.generationView!,
          history,
          inputs.enteredBiomeCount,
          context.currentShopNames,
          undefined,
          undefined,
          undefined,
          branch,
        ),
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
            settleOwnedAcquisitionSite(
              catalog,
              candidateBranches,
              {
                siteOwner: localReward.origin,
                pointKey:
                  acquisition.event.kind === 'acquisitionPointReached'
                    ? acquisition.event.point
                    : candidate.encounterPhaseKey,
                entryKey: candidate.slotKey,
                source: Object.freeze({ ...candidate, instanceProvenance: 'free' }),
                historySequence: acquisition.event.sequence,
                authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
              },
              (history) =>
                createBiomeRewardFacts(
                  catalog,
                  context.room,
                  context.room,
                  context.declaration,
                  acquisition.view!,
                  history,
                  inputs.enteredBiomeCount,
                ),
              candidateFindings,
              ownerRegion(localReward.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                context.room.origin,
                acquisition.event.sequence,
                'localRoomLifecycle',
              ),
            );
          }
          return createRewardProducerCandidateResult(candidateFindings, candidateBranches);
        },
      }),
    );
    const generated = processRewardOffer(branches, offerContext, findings);
    // Fields cages create their locked loot objects during room materialization.
    // Their later acquisition point is a pickup, not an additional loot spawn.
    branches =
      context.room.lifecycleProfileKey === 'FieldsCombatRoom'
        ? Object.freeze(
            generated.map((branch) =>
              consumeOlympianProviderForReachedOffer(catalog, branch, localReward.origin, 'free'),
            ),
          )
        : generated;
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
              ...inputs.routeLoadout,
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
              facts: (
                history: RewardHistoryState,
                _shop: ReadonlySet<string> | undefined,
                branch: RewardBranchState | undefined,
              ) =>
                createBiomeRewardFacts(
                  catalog,
                  context.source,
                  context.currentRoom,
                  context.sourceDeclaration,
                  context.generationView!,
                  history,
                  inputs.enteredBiomeCount,
                  context.currentShopNames,
                  undefined,
                  undefined,
                  undefined,
                  branch,
                ),
            }),
            candidateFindings,
          );
          if (
            candidateBranches.length > 0 &&
            acquisition.event !== undefined &&
            acquisition.view !== undefined
          )
            settleOwnedAcquisitionSite(
              catalog,
              candidateBranches,
              {
                siteOwner: candidate.origin,
                pointKey:
                  acquisition.event.kind === 'acquisitionPointReached'
                    ? acquisition.event.point
                    : candidate.encounterPhaseKey,
                entryKey: candidate.slotKey,
                source: Object.freeze({ ...candidate, instanceProvenance: 'free' }),
                historySequence: acquisition.event.sequence,
                authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
              },
              (history) =>
                createBiomeRewardFacts(
                  catalog,
                  context.room,
                  context.room,
                  context.declaration,
                  acquisition.view!,
                  history,
                  inputs.enteredBiomeCount,
                ),
              candidateFindings,
              ownerRegion(candidate.origin),
            );
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
