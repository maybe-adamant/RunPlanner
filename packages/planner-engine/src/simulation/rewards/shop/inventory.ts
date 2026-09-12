import { semanticAddressKey } from '../../../authored-project/addresses';
import {
  applyOfferProjection,
  evaluateShopGenerationSupport,
  isPayloadLocallyValid,
  type AuthoredShopOffer,
  type ShopGenerationSupport,
} from '../../../reward-kernel';
import { ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import { type RewardGenerationFindingCode } from '../../model';
import { appendRewardEvent, freezeRecord, type RewardBranchState } from '../branch-primitives';
import { addRewardFinding, historyChronology, offerEvidence, rewardFinding } from '../findings';
import { shopRequirements, type ShopProcessingContext } from './context';

export interface ShopInventoryProduct {
  readonly branches: readonly RewardBranchState[];
  readonly findingEmissions: readonly FindingRegionEntry[];
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
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    optionKey: offer.optionKey,
    offer: offer.offer,
  }));
  const next: RewardBranchState[] = [];
  const supportResults: ShopGenerationSupport[] = [];
  for (const branch of branches) {
    const support = evaluateShopGenerationSupport(
      catalog.rewards,
      profile,
      authored,
      context.facts(branch.history, new Set(), branch),
      requirements,
    );
    supportResults.push(support);
    for (const witness of support.witnesses) {
      let candidate = branch;
      for (const offer of entry.offers) {
        const offerFacts = context.facts(candidate.history, new Set(), candidate);
        const history = applyOfferProjection(
          catalog.rewards,
          candidate.history,
          offer.offer,
          offerFacts,
        );
        candidate = appendRewardEvent(Object.freeze({ ...candidate, history }), historySequence, {
          kind: 'rewardOffered',
          origin: offer.offerOrigin,
          offer: offer.offer,
        });
      }
      candidate = appendRewardEvent(candidate, historySequence, {
        kind: 'shopInventorySupported',
        origin: room.origin,
        profileKey: profile.key,
        optionKeys: witness.optionKeys,
        slotGroupIndexes: profile.groups.values.flatMap((group, groupIndex) =>
          Array.from({ length: group.offerCount }, () => groupIndex),
        ),
      });
      next.push(
        Object.freeze({
          ...candidate,
          pendingShops: freezeRecord({
            ...candidate.pendingShops,
            [semanticAddressKey(room.origin)]: Object.freeze({
              profileKey: profile.key,
              witness,
            }),
          }),
        }),
      );
    }
  }
  const findings = new Map<string, FindingRegionEntry>();
  if (next.length === 0) {
    const unsupportedIndexes = entry.offers.flatMap((_, index) =>
      supportResults.every((support) => support.unsupportedSlotIndexes.includes(index))
        ? [index]
        : [],
    );
    for (const index of unsupportedIndexes) {
      const offer = entry.offers[index]!;
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
      addRewardFinding(
        findings,
        rewardFinding('shopOfferUnavailable', room.origin, {
          offerKeys: entry.offers.map((offer) => offer.offerKey),
          kind: 'jointOfferSet',
        }),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
  }
  return Object.freeze({
    branches: Object.freeze(next),
    findingEmissions: Object.freeze([...findings.values()]),
  });
}
