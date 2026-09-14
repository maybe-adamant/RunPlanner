import type { Catalog } from '../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import { createUnresolvedShopAcquisitionRewardState } from '../../../authored-project/traits/state';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOffer,
  echoShopDuplicateOfferMatches,
} from '../../../authored-project/shop';
import {
  findShopIndexedGenerationWitnesses,
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
  type ShopProfileDeclaration,
} from '../../../reward-kernel';
import { ownerRegion, type FindingChronology } from '../../finding-regions';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  isPomUpgradeTarget,
} from '../../traits';
import type {
  PendingShopGoldMaterialization,
  PendingShopPaidOffer,
  PendingShopTravelRefill,
  RewardBranchState,
} from '../branch-primitives';
import { applyProducerRoleHistory } from '../acquisition/role-settlement';
import type {
  AcquisitionRoleFrontier,
  DerivedAcquisitionEntryFrontier,
  RewardFactsFactory,
} from '../acquisition/contracts';

export function deriveTravelRefill(input: {
  readonly catalog: Catalog;
  readonly profile: ShopProfileDeclaration;
  readonly branch: RewardBranchState;
  readonly sourceOffer: PendingShopPaidOffer;
  readonly slotIndex: number;
  readonly excludedNames: ReadonlySet<string>;
  readonly requirements: Readonly<
    Record<string, import('../../../requirements').RequirementExpression>
  >;
  readonly facts: RewardFactsFactory;
}): PendingShopTravelRefill | undefined {
  const { catalog, profile, branch, sourceOffer, slotIndex, excludedNames, requirements, facts } =
    input;
  const slot = profile.slots.values[slotIndex];
  const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
  if (slot === undefined || group === undefined) return undefined;
  const generationFacts = facts(branch.history, new Set(), branch);
  const candidateOffers = group.options.values.flatMap((option) =>
    locallyValidRewardOffers(catalog.rewards, option.rewardType),
  );
  const uniqueOffers = Object.freeze([
    ...new Map(candidateOffers.map((offer) => [JSON.stringify(offer), offer] as const)).values(),
  ]);
  const supportedOffers = (excludedPurchaseInteractionNames: ReadonlySet<string>) =>
    Object.freeze(
      uniqueOffers.filter(
        (offer) =>
          findShopIndexedGenerationWitnesses(
            catalog.rewards,
            profile,
            slotIndex,
            offer,
            generationFacts,
            requirements,
            excludedPurchaseInteractionNames.size === 0 ? {} : { excludedPurchaseInteractionNames },
          ).length > 0,
      ),
    );
  const excludedDomain = supportedOffers(excludedNames);
  const effectiveExcludedNames = excludedDomain.length > 0 ? excludedNames : new Set<string>();
  const domain = excludedDomain.length > 0 ? excludedDomain : supportedOffers(new Set());
  if (domain.length === 0) return undefined;
  const witnessesFor = (offer: ResolvedRewardOffer) =>
    findShopIndexedGenerationWitnesses(
      catalog.rewards,
      profile,
      slotIndex,
      offer,
      generationFacts,
      requirements,
      effectiveExcludedNames.size === 0
        ? {}
        : { excludedPurchaseInteractionNames: effectiveExcludedNames },
    );
  return Object.freeze({
    sourceOfferKey: sourceOffer.offerKey,
    slotIndex,
    rewardTypes: Object.freeze([...new Set(domain.map((offer) => offer.rewardType))]),
    excludedNames: effectiveExcludedNames,
    generationFacts,
    evaluateOffer: (offer: ResolvedRewardOffer) =>
      Object.freeze({
        findings: Object.freeze([]),
        supported: witnessesFor(offer).length > 0,
      }),
    evaluateShopOption: (selection: import('../../../reward-kernel').ShopOptionSelection) =>
      Object.freeze({
        findings: Object.freeze([]),
        supported: witnessesFor(selection.offer).some(
          (witness) => witness.optionKeys[slotIndex] === selection.optionKey,
        ),
      }),
  });
}

export function eligibleShopGoldSourceOfferKeys(
  catalog: Catalog,
  offers: readonly { readonly offerKey: string; readonly offer: ResolvedRewardOffer }[],
  travelOffer:
    { readonly offerKey: string; readonly offer: ResolvedRewardOffer } | null | undefined,
): readonly string[] {
  const disposition = Object.values(catalog.traits.byKey).find(
    (trait) =>
      trait.selectedDisposition?.kind === 'echo' &&
      trait.selectedDisposition.effect === 'doubleShop',
  )?.selectedDisposition;
  const eligible = (offer: ResolvedRewardOffer): boolean =>
    disposition?.kind === 'echo' &&
    disposition.effect === 'doubleShop' &&
    !disposition.excludedRewardTypes.includes(offer.rewardType);
  return Object.freeze([
    ...offers.flatMap((offer) => (eligible(offer.offer) ? [offer.offerKey] : [])),
    ...(travelOffer !== undefined && travelOffer !== null && eligible(travelOffer.offer)
      ? [travelOffer.offerKey]
      : []),
  ]);
}

export interface ShopGoldMaterializationProduct {
  readonly branch: RewardBranchState;
  readonly materialization?: PendingShopGoldMaterialization;
  readonly derivedEntryFrontiers: readonly DerivedAcquisitionEntryFrontier[];
}

export function materializeShopGold(input: {
  readonly catalog: Catalog;
  readonly branch: RewardBranchState;
  readonly pendingGold?: import('../../../authored-project/traits/state').EquippedTrait | undefined;
  readonly existingMaterialization?: PendingShopGoldMaterialization | undefined;
  readonly sourceOffer: PendingShopPaidOffer;
  readonly roleBindings: PendingShopGoldMaterialization['roleBindings'];
  readonly profile: ShopProfileDeclaration;
  readonly site: AcquisitionSiteAddress;
  readonly owner: SemanticAddress;
  readonly actionOwner?: SemanticAddress | undefined;
  readonly branchCohortSize: number;
  readonly historySequence: number;
  readonly facts: RewardFactsFactory;
  readonly findingChronology?: FindingChronology | undefined;
  readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string> | undefined;
  readonly eligibleSourceOfferKeys: readonly string[];
}): ShopGoldMaterializationProduct {
  const {
    catalog,
    branch,
    pendingGold,
    existingMaterialization,
    sourceOffer,
    roleBindings,
    profile,
    site,
    owner,
    actionOwner,
    branchCohortSize,
    historySequence,
    facts,
    findingChronology,
    authoredSeaStarDuplicateSiteKeys,
    eligibleSourceOfferKeys,
  } = input;
  if (existingMaterialization !== undefined)
    return Object.freeze({
      branch,
      materialization: existingMaterialization,
      derivedEntryFrontiers: Object.freeze([]),
    });
  const disposition =
    pendingGold === undefined
      ? undefined
      : catalog.traits.byKey[pendingGold.traitKey]?.selectedDisposition;
  if (
    pendingGold === undefined ||
    pendingGold.acquisitionIdentity === undefined ||
    disposition?.kind !== 'echo' ||
    disposition.effect !== 'doubleShop' ||
    disposition.excludedRewardTypes.includes(sourceOffer.offer.rewardType)
  )
    return Object.freeze({ branch, derivedEntryFrontiers: Object.freeze([]) });

  const address = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
  const sourceTraitHistory = branch.traitHistory ?? createTraitHistoryState();
  const traitHistory = foldTraitHistoryEvents(catalog, [
    ...sourceTraitHistory.events,
    Object.freeze({
      kind: 'traitRemoval' as const,
      owner: address,
      acquisitionRole: 'echoShopDuplicateConsumed',
      sequence: historySequence,
      acquisitionPoint: 'shopDuplicateMaterialized',
      traitKey: pendingGold.traitKey,
      acquisitionIdentity: pendingGold.acquisitionIdentity,
      match: 'acquisitionIdentity' as const,
    }),
  ]);
  const updatedBranch = Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
  });
  const materialization = Object.freeze({
    sourceOfferKey: sourceOffer.offerKey,
    roleBindings,
    sourceOffer,
    sourceTraitHistory,
    sourcePomEligibleTraitKeys: Object.freeze(
      Object.values(sourceTraitHistory.equippedTraits)
        .filter((trait) => isPomUpgradeTarget(catalog, trait))
        .map((trait) => trait.traitKey),
    ),
  });
  const branchesBeforeEntry = Object.freeze([updatedBranch]);
  const duplicateOffer = echoShopDuplicateOffer(catalog, sourceOffer.offer);
  const fixedReward =
    duplicateOffer === null
      ? undefined
      : createUnresolvedShopAcquisitionRewardState(catalog, duplicateOffer, profile.key);
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  if (fixedReward !== undefined) {
    const source = Object.freeze({
      origin: address,
      offer: fixedReward.offer,
      producerLifecycleKey: profile.key,
      producerKind: 'shop' as const,
      instanceProvenance: 'free' as const,
      traitOffersByAcquisitionRole: fixedReward.traitOffersByAcquisitionRole,
      ...(fixedReward.levelResolutionsByAcquisitionRole === undefined
        ? {}
        : { levelResolutionsByAcquisitionRole: fixedReward.levelResolutionsByAcquisitionRole }),
      dispositionByAcquisitionRole: fixedReward.dispositionByAcquisitionRole,
      ...(sourceOffer.traitContext === undefined ? {} : { traitContext: sourceOffer.traitContext }),
      ...(actionOwner === undefined ? {} : { timelineOwner: actionOwner }),
    });
    const settlement = Object.freeze({ site, entry: address });
    let candidateBranches: readonly RewardBranchState[] = branchesBeforeEntry;
    for (const binding of roleBindings) {
      const settled = applyProducerRoleHistory(
        catalog,
        candidateBranches,
        source,
        Object.freeze({ ...binding, historySequence }),
        facts,
        ownerRegion(owner),
        findingChronology,
        settlement,
        branchesBeforeEntry,
        true,
        false,
        authoredSeaStarDuplicateSiteKeys,
      );
      candidateBranches = settled.branches;
      roleFrontiers.push(...settled.roleFrontiers);
    }
  }
  return Object.freeze({
    branch: updatedBranch,
    materialization,
    derivedEntryFrontiers: Object.freeze([
      Object.freeze({
        address,
        kind: 'echoDoubleShopReward' as const,
        branchCohortSize,
        sourceOfferKey: sourceOffer.offerKey,
        rewardTypes: Object.freeze([sourceOffer.offer.rewardType]),
        ...(fixedReward === undefined ? {} : { fixedReward }),
        ...(roleFrontiers.length === 0 ? {} : { roleFrontiers: Object.freeze(roleFrontiers) }),
        eligibleSourceOfferKeys,
        branchesBeforeEntry,
        evaluateOffer: (candidateOffer: ResolvedRewardOffer) =>
          Object.freeze({
            findings: Object.freeze([]),
            supported: echoShopDuplicateOfferMatches(catalog, sourceOffer.offer, candidateOffer),
          }),
      }),
    ]),
  });
}
