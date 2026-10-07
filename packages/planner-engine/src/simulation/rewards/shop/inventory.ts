import { createShopOfferAddress, semanticAddressKey } from '../../../authored-project/addresses';
import {
  applyOfferProjection,
  assessShopInventory,
  isPayloadLocallyValid,
  type AuthoredShopOffer,
  type ShopSlotAssessment,
} from '../../../reward-kernel';
import { ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import { type RewardGenerationFindingCode } from '../../model';
import { appendRewardEvent, freezeRecord, type RewardBranchState } from '../branch-primitives';
import { addRewardFinding, historyChronology, offerEvidence, rewardFinding } from '../findings';
import { shopRequirements, type ShopProcessingContext } from './context';
import { findShopIndexedGenerationWitnesses } from '../../../reward-kernel';

export interface ShopInventoryProduct {
  readonly branches: readonly RewardBranchState[];
  readonly findingEmissions: readonly FindingRegionEntry[];
  /** Declared-slot standing across the entering cohort, keyed by slot key. */
  readonly slotAssessments: ReadonlyMap<string, ShopSlotAssessment>;
}

/**
 * Cohort agreement: valid emptiness needs every branch to have an empty group;
 * one eligible branch leaves an unset slot incomplete; a selection is invalid
 * only when no branch supports it.
 */
export function cohortSlotAssessment(
  assessments: readonly ShopSlotAssessment[],
): ShopSlotAssessment {
  if (assessments.length > 0 && assessments.every((assessment) => assessment === 'validEmpty'))
    return 'validEmpty';
  if (assessments.some((assessment) => assessment === 'incomplete')) return 'incomplete';
  if (assessments.some((assessment) => assessment === 'complete')) return 'complete';
  return 'selectedInvalid';
}

export function processShopInventory(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
): ShopInventoryProduct {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    return fail(`${room.gameName} materialized a missing shop state`);
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    return fail(`unknown shop profile ${entry.profileKey}`);
  }
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  // An unreached cohort proves nothing about any slot.
  if (branches.length === 0)
    return Object.freeze({
      branches: Object.freeze([]),
      findingEmissions: Object.freeze([]),
      slotAssessments: new Map(),
    });
  const offersByKey = new Map(entry.offers.map((offer) => [offer.offerKey, offer] as const));
  const unresolvedByKey = new Map(
    entry.unresolvedOffers.map((offer) => [offer.offerKey, offer] as const),
  );
  const slotOrigins = profile.slots.values.map((slot) => {
    const origin =
      offersByKey.get(slot.key)?.offerOrigin ?? unresolvedByKey.get(slot.key)?.offerOrigin;
    if (origin === undefined) return fail(`${room.gameName} shop lost slot ${slot.key}`);
    return origin;
  });
  const authored: readonly (AuthoredShopOffer | null)[] = profile.slots.values.map((slot) => {
    const offer = offersByKey.get(slot.key);
    return offer === undefined ? null : { optionKey: offer.optionKey, offer: offer.offer };
  });
  const assessments = branches.map((branch) =>
    assessShopInventory(
      catalog.rewards,
      profile,
      authored,
      context.facts(branch.state, new Set()),
      requirements,
    ),
  );
  const slotAssessments = new Map(
    profile.slots.values.map(
      (slot, index) =>
        [
          slot.key,
          cohortSlotAssessment(assessments.map((assessment) => assessment.slots[index]!)),
        ] as const,
    ),
  );
  const findings = new Map<string, FindingRegionEntry>();
  const incompleteIndexes = profile.slots.values.flatMap((slot, index) =>
    slotAssessments.get(slot.key) === 'incomplete' ? [index] : [],
  );
  if (incompleteIndexes.length > 0) {
    for (const index of incompleteIndexes) {
      addRewardFinding(
        findings,
        rewardFinding('rewardMissing', slotOrigins[index]!, {}),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
    return Object.freeze({
      branches: Object.freeze([]),
      findingEmissions: Object.freeze([...findings.values()]),
      slotAssessments,
    });
  }
  const next: RewardBranchState[] = [];
  const slotKeys = Object.freeze(profile.slots.values.map((slot) => slot.key));
  const slotGroupIndexes = Object.freeze(
    profile.groups.values.flatMap((group, groupIndex) =>
      Array.from({ length: group.offerCount }, () => groupIndex),
    ),
  );
  branches.forEach((branch, branchIndex) => {
    for (const witness of assessments[branchIndex]!.witnesses) {
      let candidate = branch;
      // Validly empty slots emit no item and therefore no offer.
      for (const offer of entry.offers) {
        const offerFacts = context.facts(candidate.state, new Set());
        const history = applyOfferProjection(
          catalog.rewards,
          candidate.state.rewardHistory,
          offer.offer,
          offerFacts,
        );
        candidate = appendRewardEvent(
          Object.freeze({
            ...candidate,
            state: Object.freeze({ ...candidate.state, rewardHistory: history }),
          }),
          historySequence,
          {
            kind: 'rewardOffered',
            origin: offer.offerOrigin,
            offer: offer.offer,
          },
        );
      }
      candidate = appendRewardEvent(candidate, historySequence, {
        kind: 'shopInventorySupported',
        origin: room.origin,
        profileKey: profile.key,
        slotKeys,
        optionKeys: witness.optionKeys,
        slotGroupIndexes,
      });
      next.push(
        Object.freeze({
          ...candidate,
          state: Object.freeze({
            ...candidate.state,
            pendingShops: freezeRecord({
              ...candidate.state.pendingShops,
              [semanticAddressKey(room.origin)]: Object.freeze({
                profileKey: profile.key,
                witness,
              }),
            }),
          }),
        }),
      );
    }
  });
  if (next.length === 0) {
    const unsupportedIndexes = profile.slots.values.flatMap((slot, index) =>
      slotAssessments.get(slot.key) === 'selectedInvalid' ? [index] : [],
    );
    for (const index of unsupportedIndexes) {
      const offer = offersByKey.get(profile.slots.values[index]!.key)!;
      const rewardType = catalog.rewards.rewardTypes.byKey[offer.offer.rewardType];
      const code: RewardGenerationFindingCode =
        rewardType === undefined ||
        !isPayloadLocallyValid(catalog.rewards, rewardType, offer.offer.payload)
          ? 'rewardPayloadInvalid'
          : 'shopOfferUnavailable';
      addRewardFinding(
        findings,
        rewardFinding(code, offer.offerOrigin, offerEvidence(offer.offer)),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
    if (unsupportedIndexes.length === 0) {
      const repeated = new Map(
        assessments.flatMap((assessment) =>
          assessment.repeatedSlots.map((slot) => [slot.slotIndex, slot] as const),
        ),
      );
      // Branches that disagree on which slot fails mark every slot one rejects.
      const branchRejected = profile.slots.values.flatMap((slot, index) =>
        repeated.size === 0 &&
        assessments.some((assessment) => assessment.slots[index] === 'selectedInvalid')
          ? [index]
          : [],
      );
      for (const index of branchRejected) {
        const offer = offersByKey.get(profile.slots.values[index]!.key)!;
        addRewardFinding(
          findings,
          rewardFinding('shopOfferUnavailable', offer.offerOrigin, offerEvidence(offer.offer)),
          ownerRegion(room.origin),
          context.findingChronology ?? historyChronology(historySequence),
        );
      }
      if (repeated.size === 0 && branchRejected.length === 0)
        return fail(`${room.gameName} Shop has no generation and no rejected slot`);
      for (const slot of repeated.values()) {
        const offer = offersByKey.get(profile.slots.values[slot.slotIndex]!.key)!;
        addRewardFinding(
          findings,
          rewardFinding('shopOfferUnavailable', offer.offerOrigin, {
            ...offerEvidence(offer.offer),
            kind: 'repeatedOption',
            repeatsOfferKey: profile.slots.values[slot.repeatsSlotIndex]!.key,
          }),
          ownerRegion(room.origin),
          context.findingChronology ?? historyChronology(historySequence),
        );
      }
    }
  }
  const contractProfileKey = declaration.infernalContractReward?.generationProfileKey;
  const contractProfile =
    contractProfileKey === undefined ? undefined : catalog.rewards.shops.byKey[contractProfileKey];
  const contractOffer = entry.infernalContractOffer;
  const contractOwner =
    declaration.infernalContractReward === undefined
      ? undefined
      : createShopOfferAddress(
          { kind: 'biome', routeKey: room.origin.routeKey, biomeKey: room.origin.biomeKey },
          room.origin.occurrenceId,
          'infernalContractReward',
        );
  const contractBranches: RewardBranchState[] = [];
  if (
    contractProfileKey !== undefined &&
    (contractProfile === undefined || contractProfile.slotCount !== 1)
  )
    return fail(`${room.gameName} lost its single-slot Contract profile`);
  for (const branch of next) {
    const active = branch.state.traitHistory.equippedTraits.InfernalContractBoon !== undefined;
    if (contractProfile === undefined || !active) {
      contractBranches.push(branch);
      continue;
    }
    const owner = contractOffer?.offerOrigin ?? contractOwner;
    if (contractOffer === undefined || contractOffer === null || owner === undefined) {
      addRewardFinding(
        findings,
        rewardFinding('rewardMissing', owner ?? room.origin, {}),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(context.historySequence),
      );
      continue;
    }
    const support = findShopIndexedGenerationWitnesses(
      catalog.rewards,
      contractProfile,
      0,
      contractOffer.offer,
      context.facts(branch.state, new Set(entry.offers.map((offer) => offer.offer.rewardType))),
    );
    if (support.length === 0) {
      addRewardFinding(
        findings,
        rewardFinding('shopOfferUnavailable', owner, offerEvidence(contractOffer.offer)),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(context.historySequence),
      );
      continue;
    }
    let candidate = appendRewardEvent(
      Object.freeze({
        ...branch,
        state: Object.freeze({
          ...branch.state,
          rewardHistory: applyOfferProjection(
            catalog.rewards,
            branch.state.rewardHistory,
            contractOffer.offer,
            context.facts(
              branch.state,
              new Set(entry.offers.map((offer) => offer.offer.rewardType)),
            ),
          ),
        }),
      }),
      historySequence,
      { kind: 'rewardOffered', origin: owner, offer: contractOffer.offer },
    );
    candidate = Object.freeze({
      ...candidate,
      state: Object.freeze({
        ...candidate.state,
        pendingShops: freezeRecord({
          ...candidate.state.pendingShops,
          [semanticAddressKey(room.origin)]: Object.freeze({
            ...candidate.state.pendingShops[semanticAddressKey(room.origin)]!,
            infernalContractOffer: contractOffer,
          }),
        }),
      }),
    });
    contractBranches.push(candidate);
  }
  return Object.freeze({
    branches: Object.freeze(contractBranches),
    findingEmissions: Object.freeze([...findings.values()]),
    slotAssessments,
  });
}
