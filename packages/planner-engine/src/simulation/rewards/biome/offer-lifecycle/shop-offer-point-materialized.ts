import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createShopOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import {
  findShopPartialAuthoredGenerationWitnesses,
  type AuthoredShopOffer,
  type ShopOptionSelection,
} from '../../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalResolvedIncomingReward,
} from '../../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { RewardHistoryState } from '../../../../reward-kernel';
import { createBiomeRewardFacts } from '../../facts';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { addRewardFinding, mergeRewardFindingEmissions, rewardFinding } from '../../findings';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { RewardBranchState } from '../../branch-primitives';
import type { RewardProducerFrontier } from '../../producer-frontiers';
import { processShopInventory } from '../../shop/inventory';

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
  const contractOwner =
    declaration.infernalContractReward === undefined ||
    !frontierBranches.some(
      (branch) => branch.state.traitHistory.equippedTraits.InfernalContractBoon !== undefined,
    )
      ? undefined
      : createShopOfferAddress(
          { kind: 'biome', routeKey: room.origin.routeKey, biomeKey: room.origin.biomeKey },
          room.origin.occurrenceId,
          'infernalContractReward',
        );
  const owners = Object.freeze([
    ...(shopEntry?.offers.map((offer) => offer.offerOrigin) ?? []),
    ...(shopEntry?.unresolvedOffers.map((offer) => offer.offerOrigin) ?? []),
    ...(contractOwner === undefined ? [] : [contractOwner]),
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
    const candidateContext = (owner: SemanticAddress) => {
      if (shopEntry === undefined)
        throw new BiomeRewardSimulationContractError(
          `${room.gameName} lost its shop candidate state`,
        );
      const ownerKey = semanticAddressKey(owner);
      if (!ownerKeys.has(ownerKey))
        throw new BiomeRewardSimulationContractError(
          'shop reward frontier received a foreign owner',
        );
      const contract = shopEntry.infernalContractOffer;
      const isContract =
        contractOwner !== undefined && semanticAddressKey(contractOwner) === ownerKey;
      const profile =
        catalog.rewards.shops.byKey[
          isContract
            ? (declaration.infernalContractReward?.generationProfileKey ?? '')
            : shopEntry.profileKey
        ];
      if (profile === undefined)
        throw new BiomeRewardSimulationContractError(
          `unknown shop profile ${shopEntry.profileKey}`,
        );
      const focused =
        (isContract
          ? contract === null || contract === undefined
            ? []
            : [contract]
          : [...shopEntry.offers, ...shopEntry.unresolvedOffers]
        ).find((entry) => semanticAddressKey(entry.offerOrigin) === ownerKey) ??
        (isContract
          ? { offerKey: 'infernalContractReward', offerOrigin: contractOwner! }
          : undefined);
      if (focused === undefined)
        throw new BiomeRewardSimulationContractError('shop reward frontier lost its owner');
      return Object.freeze({
        profile,
        focused,
        concreteByKey: new Map<string, AuthoredShopOffer>(
          (isContract
            ? contract === null || contract === undefined
              ? []
              : [contract]
            : shopEntry.offers
          ).map((entry) => [
            entry.offerKey,
            Object.freeze({ optionKey: entry.optionKey, offer: entry.offer }),
          ]),
        ),
        requirements: isContract
          ? undefined
          : declaration.incomingReward.kind === 'shop'
            ? declaration.incomingReward.additionalOptionRequirements
            : undefined,
      });
    };
    const supportsSelection = (owner: SemanticAddress, selection: AuthoredShopOffer): boolean => {
      const context = candidateContext(owner);
      const isContract = context.focused.offerKey === 'infernalContractReward';
      const fixedOffers = context.profile.slots.values.map((slot) =>
        slot.key === context.focused.offerKey
          ? selection
          : (context.concreteByKey.get(slot.key) ?? null),
      );
      return frontierBranches.some(
        (branch) =>
          findShopPartialAuthoredGenerationWitnesses(
            catalog.rewards,
            context.profile,
            fixedOffers,
            facts(
              branch.state.rewardHistory,
              new Set(isContract ? shopEntry!.offers.map((offer) => offer.offer.rewardType) : []),
              branch,
            ),
            context.requirements,
          ).length > 0 &&
          (!isContract ||
            branch.state.traitHistory.equippedTraits.InfernalContractBoon !== undefined),
      );
    };
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
          const context = candidateContext(owner);
          const current = context.concreteByKey.get(context.focused.offerKey);
          return Object.freeze({
            findings: Object.freeze([]),
            supported: supportsSelection(owner, {
              optionKey:
                current?.offer.rewardType === offer.rewardType ? (current.optionKey ?? null) : null,
              offer,
            }),
          });
        },
        evaluateShopOption: (owner: SemanticAddress, selection: ShopOptionSelection) => {
          return Object.freeze({
            findings: Object.freeze([]),
            supported: supportsSelection(owner, selection),
          });
        },
      }),
    );
  }

  const inventory =
    (shopEntry?.unresolvedOffers.length ?? 0) > 0
      ? undefined
      : processShopInventory(branches, {
          catalog,
          room,
          declaration,
          historySequence: event.sequence,
          findingChronology,
          facts,
          fail: (detail) => {
            throw new BiomeRewardSimulationContractError(detail);
          },
        });
  if (inventory !== undefined) mergeRewardFindingEmissions(findings, inventory.findingEmissions);
  const nextBranches = inventory?.branches ?? Object.freeze([]);
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
