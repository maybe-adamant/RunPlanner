import { createShopOfferAddress, semanticAddressKey } from '../../../authored-project/addresses';
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
import { findShopIndexedGenerationWitnesses } from '../../../reward-kernel';

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
      context.facts(branch.state, new Set()),
      requirements,
    );
    supportResults.push(support);
    for (const witness of support.witnesses) {
      let candidate = branch;
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
        optionKeys: witness.optionKeys,
        slotGroupIndexes: profile.groups.values.flatMap((group, groupIndex) =>
          Array.from({ length: group.offerCount }, () => groupIndex),
        ),
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
  });
}
