import { semanticAddressKey } from '../../../authored-project/addresses';
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

export interface ShopInventoryProduct {
  readonly branch: RewardBranchState | undefined;
  readonly findingEmissions: readonly FindingRegionEntry[];
  /** Declared-slot standing at the entering state, keyed by slot key. */
  readonly slotAssessments: ReadonlyMap<string, ShopSlotAssessment>;
}

export function processShopInventory(
  branch: RewardBranchState | undefined,
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
  // An unreached Shop proves nothing about any slot.
  if (branch === undefined)
    return Object.freeze({
      branch: undefined,
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
  const assessment = assessShopInventory(
    catalog.rewards,
    profile,
    authored,
    context.facts(branch.state, new Set()),
    requirements,
  );
  const slotAssessments = new Map(
    profile.slots.values.map((slot, index) => [slot.key, assessment.slots[index]!] as const),
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
      branch: undefined,
      findingEmissions: Object.freeze([...findings.values()]),
      slotAssessments,
    });
  }
  // Exact options admit one assignment; a retained offer without its option
  // may fit several, and the first in declared option order is the one generated.
  let next: RewardBranchState | undefined;
  const slotKeys = Object.freeze(profile.slots.values.map((slot) => slot.key));
  const slotGroupIndexes = Object.freeze(
    profile.groups.values.flatMap((group, groupIndex) =>
      Array.from({ length: group.offerCount }, () => groupIndex),
    ),
  );
  const witness = assessment.witnesses[0];
  if (witness !== undefined) {
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
    next = Object.freeze({
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
    });
  }
  if (next === undefined) {
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
        assessment.repeatedSlots.map((slot) => [slot.slotIndex, slot] as const),
      );
      const rejected = profile.slots.values.flatMap((_slot, index) =>
        repeated.size === 0 && assessment.slots[index] === 'selectedInvalid' ? [index] : [],
      );
      for (const index of rejected) {
        const offer = offersByKey.get(profile.slots.values[index]!.key)!;
        addRewardFinding(
          findings,
          rewardFinding('shopOfferUnavailable', offer.offerOrigin, offerEvidence(offer.offer)),
          ownerRegion(room.origin),
          context.findingChronology ?? historyChronology(historySequence),
        );
      }
      if (repeated.size === 0 && rejected.length === 0)
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
  return Object.freeze({
    branch: next,
    findingEmissions: Object.freeze([...findings.values()]),
    slotAssessments,
  });
}
