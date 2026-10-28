import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createInfernalContractPedestalAddress,
  createBiomeAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import {
  applyOfferProjection,
  findShopIndexedGenerationWitnesses,
  findShopPartialAuthoredGenerationWitnesses,
  type AuthoredShopOffer,
  type ShopOptionSelection,
} from '../../../../reward-kernel';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { RewardFactsFactory } from '../../acquisition/contracts';
import { addRewardFinding, historyChronology, offerEvidence, rewardFinding } from '../../findings';
import { appendRewardEvent, type RewardBranchState } from '../../branch-primitives';
import type { RewardProducerFrontier } from '../../producer-frontiers';
import { aggregateRewardOfferExclusions, staticRewardOfferExclusion } from '../../offer-exclusions';
import {
  notInShopReason,
  shopSlotReason,
  type ShopSlotExclusionInput,
} from '../../shop/slot-exclusions';
import { spawnPickups } from '../../../state/pending-resource-pickups';
import type { SimulationState } from '../../../state/model';
import type { FindingChronology } from '../../../finding-regions';
import { BiomeRewardSimulationContractError } from '../biome-contract';

export interface InfernalContractPedestalSpawn {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
}

export function infernalContractHeld(state: SimulationState): boolean {
  return state.traitHistory.equippedTraits.InfernalContractBoon !== undefined;
}

/**
 * `SpawnZagContractRewards` runs with the room's start events in every
 * pedestal-declaring Preboss, whatever its reward form, on each branch holding
 * InfernalContractBoon. Its one ZagPedestalOptions draw sees the Shop the same
 * events stocked first, when the room has one.
 */
export function spawnInfernalContractPedestal(inputs: {
  readonly catalog: Catalog;
  readonly historySequence: number;
  readonly room: CanonicalAuthoredRoom | undefined;
  readonly declaration: RoomDeclaration | undefined;
  readonly branches: readonly RewardBranchState[];
  /** The room's Overview facts, seeing the Shop names its start events stocked. */
  readonly facts: RewardFactsFactory;
  readonly findingChronology?: FindingChronology;
}): InfernalContractPedestalSpawn {
  const { catalog, historySequence, room, declaration, branches } = inputs;
  const findingChronology = inputs.findingChronology ?? historyChronology(historySequence);
  const pedestal = room?.infernalContractPedestal;
  if (room === undefined || pedestal === undefined || branches.length === 0)
    return Object.freeze({
      branches,
      findings: Object.freeze([]),
      producerFrontiers: Object.freeze([]),
    });
  const descriptor = declaration?.infernalContractReward;
  const profile =
    descriptor === undefined
      ? undefined
      : catalog.rewards.shops.byKey[descriptor.generationProfileKey];
  if (descriptor === undefined || profile === undefined || profile.slotCount !== 1)
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} lost its single-slot Contract profile`,
    );
  const owner = createInfernalContractPedestalAddress(
    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
    room.origin.occurrenceId,
  );
  const shopNames: ReadonlySet<string> = new Set(
    room.entryState?.offers.map((offer) => offer.offer.rewardType) ?? [],
  );
  const facts = (state: SimulationState) => inputs.facts(state, shopNames);
  const findings = new Map<string, FindingRegionEntry>();
  const next: RewardBranchState[] = [];
  for (const branch of branches) {
    if (!infernalContractHeld(branch.state)) {
      next.push(branch);
      continue;
    }
    if (pedestal === null) {
      addRewardFinding(
        findings,
        rewardFinding('rewardMissing', owner, {}),
        ownerRegion(room.origin),
        findingChronology,
      );
      continue;
    }
    if (
      findShopIndexedGenerationWitnesses(
        catalog.rewards,
        profile,
        0,
        pedestal.offer,
        facts(branch.state),
      ).length === 0
    ) {
      addRewardFinding(
        findings,
        rewardFinding('shopOfferUnavailable', owner, offerEvidence(pedestal.offer)),
        ownerRegion(room.origin),
        findingChronology,
      );
      continue;
    }
    const offered = appendRewardEvent(
      Object.freeze({
        ...branch,
        state: Object.freeze({
          ...branch.state,
          rewardHistory: applyOfferProjection(
            catalog.rewards,
            branch.state.rewardHistory,
            pedestal.offer,
            facts(branch.state),
          ),
        }),
      }),
      historySequence,
      { kind: 'rewardOffered', origin: owner, offer: pedestal.offer },
    );
    // The item stores its resources as it spawns; its pool is its producer.
    next.push(
      Object.freeze({
        ...offered,
        state: spawnPickups(catalog, offered.state, [
          Object.freeze({
            origin: owner,
            offer: pedestal.offer,
            producerLifecycleKey: descriptor.generationProfileKey,
            traitOffersByAcquisitionRole: pedestal.traitOffersByAcquisitionRole,
            levelResolutionsByAcquisitionRole: pedestal.levelResolutionsByAcquisitionRole,
            ...(pedestal.hexActivationsByAcquisitionRole === undefined
              ? {}
              : { hexActivationsByAcquisitionRole: pedestal.hexActivationsByAcquisitionRole }),
          }),
        ]),
      }),
    );
  }

  const holders = branches.filter((branch) => infernalContractHeld(branch.state));
  const producerFrontiers: RewardProducerFrontier[] = [];
  if (holders.length > 0) {
    const ownerKey = semanticAddressKey(owner);
    const requireOwner = (candidate: SemanticAddress) => {
      if (semanticAddressKey(candidate) !== ownerKey)
        throw new BiomeRewardSimulationContractError(
          'pedestal reward frontier received a foreign owner',
        );
    };
    const supported = (branch: RewardBranchState, selection: AuthoredShopOffer) =>
      findShopPartialAuthoredGenerationWitnesses(
        catalog.rewards,
        profile,
        [selection],
        facts(branch.state),
      ).length > 0;
    const selectionResult = (candidate: SemanticAddress, selection: AuthoredShopOffer) => {
      requireOwner(candidate);
      if (holders.some((branch) => supported(branch, selection)))
        return Object.freeze({ findings: Object.freeze([]), supported: true });
      const input: ShopSlotExclusionInput = {
        catalog: catalog.rewards,
        profile,
        fixedOffers: [selection],
        slotIndex: 0,
        peerAt: () => undefined,
      };
      const fixed = notInShopReason(input);
      const exclusions =
        fixed !== undefined
          ? staticRewardOfferExclusion(fixed)
          : aggregateRewardOfferExclusions(
              // Inventory witnesses are checked before the Contract boon.
              branches.map((branch) =>
                !supported(branch, selection)
                  ? shopSlotReason(input, facts(branch.state))
                  : !infernalContractHeld(branch.state)
                    ? { kind: 'contractNotEquipped' as const }
                    : undefined,
              ),
            );
      return Object.freeze({
        findings: Object.freeze([]),
        supported: false,
        ...(exclusions === undefined ? {} : { exclusions }),
      });
    };
    producerFrontiers.push(
      Object.freeze({
        generationPolicy: 'jointShopInventory',
        generationHistorySequence: historySequence,
        reachableBranchCount: branches.length,
        acquisitionHorizon: 'generationOnly',
        owners: Object.freeze([owner]),
        evaluateOffer: (candidate: SemanticAddress, offer: AuthoredShopOffer['offer']) =>
          selectionResult(candidate, {
            optionKey:
              pedestal !== null && pedestal.offer.rewardType === offer.rewardType
                ? pedestal.optionKey
                : null,
            offer,
          }),
        evaluateShopOption: (candidate: SemanticAddress, selection: ShopOptionSelection) =>
          selectionResult(candidate, selection),
      }),
    );
  }
  return Object.freeze({
    branches: Object.freeze(next),
    findings: Object.freeze([...findings.values()]),
    producerFrontiers: Object.freeze(producerFrontiers),
  });
}
