import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  semanticAddressKey,
  type SemanticAddress,
  type ShopOfferAddress,
} from '../../../../authored-project/addresses';
import {
  findShopPartialAuthoredGenerationWitnesses,
  type AuthoredShopOffer,
  type ShopOptionSelection,
} from '../../../../reward-kernel';
import type { HistoryEvent, RoomOverviewHistoryViews } from '../../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalResolvedIncomingReward,
} from '../../../materialization';
import type { FindingRegionEntry } from '../../../finding-regions';
import { createBiomeRewardFacts } from '../../facts';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { mergeRewardFindingEmissions } from '../../findings';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { spawnPickups } from '../../../state/pending-resource-pickups';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { RewardBranchState } from '../../branch-primitives';
import type { RewardProducerFrontier } from '../../producer-frontiers';
import { aggregateRewardOfferExclusions, staticRewardOfferExclusion } from '../../offer-exclusions';
import {
  notInShopReason,
  shopSlotReason,
  type ShopSlotExclusionInput,
} from '../../shop/slot-exclusions';
import { processShopInventory } from '../../shop/inventory';
import type { SimulationState } from '../../../state/model';
import { attestSharedRewardLookups } from '../../../state/reward-lookups';

export interface ShopOfferPointMaterializationInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'offerPointMaterialized' }>;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly roomView: RoomOverviewHistoryViews;
  readonly branches: readonly RewardBranchState[];
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
  const { catalog, snapshot, event, room, declaration, roomView, branches } = inputs;
  if (event.offerPoint !== 'shopInventory')
    throw new BiomeRewardSimulationContractError('Shop offer transition received a non-Shop point');

  const findings = new Map<string, FindingRegionEntry>();
  // Shop inventory consults the completed hub board through each branch's own
  // reached snapshot; the entering cohort must still agree on that board.
  attestSharedRewardLookups(branches.map((branch) => branch.state));
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
  const facts = (state: SimulationState, shopNames: ReadonlySet<string> = new Set()) =>
    createBiomeRewardFacts({
      catalog,
      state,
      source: room,
      currentRoom: room,
      sourceDeclaration: declaration,
      view: roomView.preparation,
      currentRoomShopOptionNames: shopNames,
      hubBoardLookups: 'consulted',
    });

  const inventory =
    shopEntry === undefined
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
      const profile = catalog.rewards.shops.byKey[shopEntry.profileKey];
      if (profile === undefined)
        throw new BiomeRewardSimulationContractError(
          `unknown shop profile ${shopEntry.profileKey}`,
        );
      const focused = [...shopEntry.offers, ...shopEntry.unresolvedOffers].find(
        (entry) => semanticAddressKey(entry.offerOrigin) === ownerKey,
      );
      if (focused === undefined)
        throw new BiomeRewardSimulationContractError('shop reward frontier lost its owner');
      return Object.freeze({
        profile,
        focused,
        concreteByKey: new Map<string, AuthoredShopOffer>(
          shopEntry.offers.map((entry) => [
            entry.offerKey,
            Object.freeze({ optionKey: entry.optionKey, offer: entry.offer }),
          ]),
        ),
        requirements:
          declaration.incomingReward.kind === 'shop'
            ? declaration.incomingReward.additionalOptionRequirements
            : undefined,
      });
    };
    const selectionInputs = (owner: SemanticAddress, selection: AuthoredShopOffer) => {
      const context = candidateContext(owner);
      const fixedOffers = context.profile.slots.values.map((slot) =>
        slot.key === context.focused.offerKey
          ? selection
          : (context.concreteByKey.get(slot.key) ?? null),
      );
      return { context, fixedOffers };
    };
    const hasWitnesses = (
      branch: (typeof frontierBranches)[number],
      { context, fixedOffers }: ReturnType<typeof selectionInputs>,
    ) =>
      findShopPartialAuthoredGenerationWitnesses(
        catalog.rewards,
        context.profile,
        fixedOffers,
        facts(branch.state),
        context.requirements,
      ).length > 0;
    const supportsSelection = (owner: SemanticAddress, selection: AuthoredShopOffer): boolean => {
      const inputs = selectionInputs(owner, selection);
      return frontierBranches.some((branch) => hasWitnesses(branch, inputs));
    };
    const explainSelection = (owner: SemanticAddress, selection: AuthoredShopOffer) => {
      const inputs = selectionInputs(owner, selection);
      const { context, fixedOffers } = inputs;
      const input: ShopSlotExclusionInput = {
        catalog: catalog.rewards,
        profile: context.profile,
        fixedOffers,
        slotIndex: context.profile.slots.values.findIndex(
          (slot) => slot.key === context.focused.offerKey,
        ),
        ...(context.requirements === undefined ? {} : { requirements: context.requirements }),
        peerAt: (index) => {
          const key = context.profile.slots.values[index]?.key;
          const peer = shopEntry?.offers.find((offer) => offer.offerKey === key);
          return peer === undefined ? undefined : { origin: peer.offerOrigin, offer: peer.offer };
        },
      };
      const fixed = notInShopReason(input);
      if (fixed !== undefined) return staticRewardOfferExclusion(fixed);
      return aggregateRewardOfferExclusions(
        frontierBranches.map((branch) =>
          !hasWitnesses(branch, inputs) ? shopSlotReason(input, facts(branch.state)) : undefined,
        ),
      );
    };
    const selectionResult = (owner: SemanticAddress, selection: AuthoredShopOffer) => {
      if (supportsSelection(owner, selection))
        return Object.freeze({ findings: Object.freeze([]), supported: true });
      const exclusions = explainSelection(owner, selection);
      return Object.freeze({
        findings: Object.freeze([]),
        supported: false,
        ...(exclusions === undefined ? {} : { exclusions }),
      });
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
          return selectionResult(owner, {
            optionKey:
              current?.offer.rewardType === offer.rewardType ? (current.optionKey ?? null) : null,
            offer,
          });
        },
        evaluateShopOption: (owner: SemanticAddress, selection: ShopOptionSelection) =>
          selectionResult(owner, selection),
        shopSlotAssessment: (owner: ShopOfferAddress) =>
          ownerKeys.has(semanticAddressKey(owner))
            ? inventory?.slotAssessments.get(owner.offerKey)
            : undefined,
      }),
    );
  }

  // World Shop loot is spawned at room entry with its options built.
  const nextBranches = Object.freeze(
    (inventory?.branches ?? []).map((branch) => {
      // Store items store their resources as they spawn; the Shop profile is their producer.
      const spawned = (shopEntry?.offers ?? []).map((offer) =>
        Object.freeze({
          origin: offer.offerOrigin,
          offer: offer.offer,
          producerLifecycleKey: shopEntry!.profileKey,
          traitOffersByAcquisitionRole: offer.traitOffersByAcquisitionRole,
          levelResolutionsByAcquisitionRole: offer.levelResolutionsByAcquisitionRole,
          ...(offer.hexActivationsByAcquisitionRole === undefined
            ? {}
            : { hexActivationsByAcquisitionRole: offer.hexActivationsByAcquisitionRole }),
        }),
      );
      return Object.freeze({ ...branch, state: spawnPickups(catalog, branch.state, spawned) });
    }),
  );
  return Object.freeze({
    branches: nextBranches,
    findings: Object.freeze([...findings.values()]),
    producerFrontiers: Object.freeze(producerFrontiers),
  });
}
