import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../../authored-project/addresses';
import { findShopPartialGenerationWitnesses } from '../../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalResolvedIncomingReward,
} from '../../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { RewardHistoryState } from '../../../../reward-kernel';
import { createBiomeRewardFacts } from '../../facts';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { addRewardFinding, rewardFinding } from '../../findings';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { RewardBranchState } from '../../branch-primitives';
import type { RewardProducerFrontier } from '../../producer-frontiers';
import { processShopInventory } from '../../shop-settlement';

export interface ShopOfferPointMaterializationInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'offerPointMaterialized' }>;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly roomView: ProgressiveRoomHistoryViews;
  readonly branches: readonly RewardBranchState[];
  readonly enteredBiomeCount: number;
  /** Reward lookup facts prepared for this exact reward-evaluation pass. */
  readonly rewardLookups: Readonly<Record<string, ReadonlySet<string>>>;
}

export interface ShopOfferPointMaterialization {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
}

/**
 * Evaluates the reached Shop inventory materialization point. The returned
 * frontier deliberately closes over the exact pre-materialization branch
 * cohort, because a Shop's authored offers are jointly constrained.
 */
export function applyShopOfferPointMaterialization(
  inputs: ShopOfferPointMaterializationInputs,
): ShopOfferPointMaterialization {
  const {
    catalog,
    snapshot,
    event,
    room,
    declaration,
    roomView,
    branches,
    enteredBiomeCount,
    rewardLookups,
  } = inputs;
  if (event.offerPoint !== 'shopInventory')
    throw new BiomeRewardSimulationContractError('Shop offer transition received a non-Shop point');

  const findings = new Map<string, FindingRegionEntry>();
  const frontierBranches = branches;
  const shopEntry = room.entryState?.kind === 'shop' ? room.entryState : undefined;
  const owners = Object.freeze([
    ...(shopEntry?.offers.map((offer) => offer.offerOrigin) ?? []),
    ...(shopEntry?.unresolvedOffers.map((offer) => offer.offerOrigin) ?? []),
  ]);
  const ownerKeys = new Set(owners.map(semanticAddressKey));
  const findingChronology = rewardFindingChronologyForRoom(
    snapshot,
    room.origin,
    event.sequence,
    'localRoomLifecycle',
  );
  const facts = (
    branchHistory: RewardHistoryState,
    shopNames: ReadonlySet<string> = new Set(),
    branch?: RewardBranchState,
  ) =>
    createBiomeRewardFacts(
      catalog,
      room,
      room,
      declaration,
      roomView.preparation,
      branchHistory,
      enteredBiomeCount,
      shopNames,
      undefined,
      undefined,
      rewardLookups,
      branch,
    );

  const producerFrontiers: RewardProducerFrontier[] = [];
  if (owners.length > 0) {
    producerFrontiers.push(
      Object.freeze({
        generationPolicy: 'jointShopInventory',
        generationHistorySequence: event.sequence,
        reachableBranchCount: frontierBranches.length,
        acquisitionHorizon: 'generationOnly',
        owners,
        evaluateOffer: (
          owner: SemanticAddress,
          offer: CanonicalResolvedIncomingReward['offer'],
        ) => {
          if (shopEntry === undefined)
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} lost its shop candidate state`,
            );
          const ownerKey = semanticAddressKey(owner);
          if (!ownerKeys.has(ownerKey))
            throw new BiomeRewardSimulationContractError(
              'shop reward frontier received a foreign owner',
            );
          const profile = catalog.rewards.shops.byKey[shopEntry.profileKey];
          if (profile === undefined)
            throw new BiomeRewardSimulationContractError(
              `unknown shop profile ${shopEntry.profileKey}`,
            );
          const concreteByKey = new Map(
            shopEntry.offers.map((entry) => [entry.offerKey, entry.offer] as const),
          );
          const focused = [...shopEntry.offers, ...shopEntry.unresolvedOffers].find(
            (entry) => semanticAddressKey(entry.offerOrigin) === ownerKey,
          );
          if (focused === undefined)
            throw new BiomeRewardSimulationContractError('shop reward frontier lost its owner');
          const fixedOffers = profile.slots.values.map((slot) =>
            slot.key === focused.offerKey ? offer : (concreteByKey.get(slot.key) ?? null),
          );
          const requirements =
            declaration.incomingReward.kind === 'shop'
              ? declaration.incomingReward.additionalOptionRequirements
              : undefined;
          const supported = frontierBranches.some(
            (branch) =>
              findShopPartialGenerationWitnesses(
                catalog.rewards,
                profile,
                fixedOffers,
                facts(branch.history, new Set(), branch),
                requirements,
              ).length > 0,
          );
          return Object.freeze({ findings: Object.freeze([]), supported });
        },
      }),
    );
  }

  const nextBranches =
    (shopEntry?.unresolvedOffers.length ?? 0) > 0
      ? Object.freeze([])
      : processShopInventory(
          branches,
          {
            catalog,
            room,
            declaration,
            historySequence: event.sequence,
            findingChronology,
            facts,
            fail: (detail) => {
              throw new BiomeRewardSimulationContractError(detail);
            },
          },
          findings,
        );
  if ((shopEntry?.unresolvedOffers.length ?? 0) > 0) {
    for (const unresolved of shopEntry!.unresolvedOffers) {
      addRewardFinding(
        findings,
        rewardFinding('rewardMissing', unresolved.offerOrigin, {}),
        ownerRegion(room.origin),
        findingChronology,
      );
    }
  }

  return Object.freeze({
    branches: nextBranches,
    findings: Object.freeze([...findings.values()]),
    producerFrontiers: Object.freeze(producerFrontiers),
  });
}
