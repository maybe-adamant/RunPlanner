import type { SemanticAddress } from '../../../authored-project/addresses';
import type { RequirementExpression } from '../../../requirements';
import { requirementEvidence } from '../../../requirements/evidence';
import {
  shopSlotExclusion,
  shopSlotStocksOffer,
  type AuthoredShopOffer,
  type ResolvedRewardOffer,
  type RewardKernelCatalog,
  type RewardKernelFacts,
  type ShopGenerationConstraints,
  type ShopProfileDeclaration,
} from '../../../reward-kernel';
import { sourceSupportReason, type RewardOfferExclusionReason } from '../offer-exclusions';

export interface ShopSlotExclusionInput {
  readonly catalog: RewardKernelCatalog;
  readonly profile: ShopProfileDeclaration;
  readonly fixedOffers: readonly (AuthoredShopOffer | null)[];
  readonly slotIndex: number;
  readonly requirements?: Readonly<Record<string, RequirementExpression>>;
  readonly constraints?: ShopGenerationConstraints;
  /** The authored peer occupying another slot, for peer-conflict evidence. */
  readonly peerAt: (
    slotIndex: number,
  ) => { readonly origin: SemanticAddress; readonly offer: ResolvedRewardOffer } | undefined;
}

/** Static: the slot's group stocks no option for the authored offer. */
export function notInShopReason(
  input: ShopSlotExclusionInput,
): RewardOfferExclusionReason | undefined {
  const authored = input.fixedOffers[input.slotIndex];
  return authored === undefined ||
    authored === null ||
    shopSlotStocksOffer(input.profile, input.slotIndex, authored)
    ? undefined
    : { kind: 'notInShop', profileKey: input.profile.key, slotIndex: input.slotIndex };
}

/** One branch's first failing Shop gate for the authored slot offer. */
export function shopSlotReason(
  input: ShopSlotExclusionInput,
  facts: RewardKernelFacts,
): RewardOfferExclusionReason | undefined {
  const exclusion = shopSlotExclusion(
    input.catalog,
    input.profile,
    input.fixedOffers,
    input.slotIndex,
    facts,
    input.requirements,
    input.constraints,
  );
  const authored = input.fixedOffers[input.slotIndex];
  switch (exclusion?.kind) {
    case undefined:
      return undefined;
    case 'notInShop':
      return notInShopReason(input);
    case 'peerConflict':
      return {
        kind: 'peerConflict',
        peers: exclusion.slotIndices.flatMap((index) => {
          const peer = input.peerAt(index);
          return peer === undefined ? [] : [peer];
        }),
      };
    case 'shopExcluded':
      return { kind: 'shopExcluded', name: exclusion.name };
    case 'shopOptionRequirement':
      return {
        kind: 'shopOptionRequirement',
        optionKey: exclusion.option.key,
        rewardType: exclusion.option.rewardType,
        evaluation: requirementEvidence(exclusion.requirement, facts.requirements),
      };
    case 'source':
      return authored === undefined || authored === null
        ? undefined
        : sourceSupportReason(input.catalog, authored.offer, facts, 'offer');
  }
}
