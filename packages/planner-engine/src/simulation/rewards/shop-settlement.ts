import type { Catalog, RoomDeclaration } from '../../catalog-schema';

import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';

import {
  createUnresolvedAcquisitionRewardState,
  createUnresolvedShopAcquisitionRewardState,
} from '../../authored-project/traits';
import { parseArtificerReplacementEntryKey } from '../../authored-project/artificer';

import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOffer,
  echoShopDuplicateOfferMatches,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../authored-project/shop';
import {
  applyOfferProjection,
  evaluateShopGenerationSupport,
  evaluateShopPurchaseAtSlot,
  findShopIndexedGenerationWitnesses,
  purchaseInteractionName,
  isPayloadLocallyValid,
  locallyValidRewardOffers,
  type AuthoredShopOffer,
  type ResolvedRewardOffer,
  type ShopGenerationSupport,
  type ShopGenerationWitness,
  type ShopOptionEntry,
  type ProducerLifecyclePointKey,
} from '../../reward-kernel';

import type { CanonicalAuthoredRoom, CanonicalLocalVisitRoom } from '../materialization';
import { isAcquisitionAuthorshipMissingFinding, type RewardGenerationFindingCode } from '../model';
import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';

import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  isPomUpgradeTarget,
} from '../traits';

import {
  appendRewardEvent,
  freezeRecord,
  mergeEquivalentRewardBranches,
  offerEvidence,
  type PendingShopGoldMaterialization,
  type PendingShopPaidOffer,
  type PendingShopTravelRefill,
  type RewardBranchState,
} from './branch-primitives';
import { type ReachedTraitChildCheckpoint } from './trait-settlement';
import { addRewardFinding, rewardFinding } from './findings';

export type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalVisitRoom;

import {
  applyProducerRoleHistory,
  withStoredArtificerReplacements,
  historyChronology,
  settleOwnedAcquisitionSite,
  type AcquisitionRoleFrontier,
  type AcquisitionSettlementProduct,
  type AcquisitionSource,
  type DerivedAcquisitionEntryFrontier,
  type RewardFactsFactory,
} from './acquisition-settlement';
function shopRequirements(
  declaration: RoomDeclaration,
  profileKey: string,
  fail: (detail: string) => never,
) {
  const binding = declaration.incomingReward;
  if (binding.kind !== 'shop' || binding.shopProfileKey !== profileKey) {
    return fail(`${declaration.gameName} has no ${profileKey} shop binding`);
  }
  return binding.additionalOptionRequirements ?? Object.freeze({});
}

export interface ShopProcessingContext {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly historySequence: number;
  readonly findingChronology?: FindingChronology;
  readonly facts: RewardFactsFactory;
  readonly fail: (detail: string) => never;
  /** Exact participating Shop actions for this settlement invocation. */
  readonly order?: readonly string[];
  /** The current action is the final Shop-owned chronology row in this room. */
  readonly completeAfterOrder?: boolean;
  /** Exact authored Sea Star result sites whose source frontier must be retained. */
  readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
}

export function processShopInventory(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
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
  return Object.freeze(next);
}

/** Settles optional Shop offer entries at the exact post-outgoing roomExit site. */
export function settleShopAcquisitionSite(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): AcquisitionSettlementProduct {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') return fail(`${room.gameName} applied missing shop purchases`);
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) return fail(`unknown shop profile ${entry.profileKey}`);
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
  }));
  const order =
    context.order ??
    Object.freeze(
      room.roomActions.order.flatMap((reference) => {
        if (reference.kind === 'interactShopOffer') return [reference.offerKey];
        if (reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'roomExit')
          return [reference.entryKey];
        return [];
      }),
    );
  if (new Set(order).size !== order.length)
    return fail(`${room.gameName} acquisition order contains a duplicate entry`);
  const findingKeysBeforeSettlement = new Set(findings.keys());
  const site = createAcquisitionSiteAddress(room.origin, 'roomExit');
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const derivedEntryFrontiers: DerivedAcquisitionEntryFrontier[] = [];
  let entryPurchaseFailureRecorded = false;
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const runtimeOfferFallbacks: {
    address: SemanticAddress;
    preferredRewardType: string;
    fallbackRewardType: string;
  }[] = [];
  const rolesByOfferKey = new Map<
    string,
    readonly { readonly role: string; readonly lifecyclePoint: ProducerLifecyclePointKey }[]
  >();
  const recordRoles = (
    offerKey: string,
    roles: readonly { readonly role: string; readonly lifecyclePoint: ProducerLifecyclePointKey }[],
  ) => {
    const existing = rolesByOfferKey.get(offerKey) ?? [];
    const seen = new Set(existing.map((role) => `${role.role}:${role.lifecyclePoint}`));
    rolesByOfferKey.set(
      offerKey,
      Object.freeze([
        ...existing,
        ...roles.filter((role) => {
          const key = `${role.role}:${role.lifecyclePoint}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      ]),
    );
  };
  type TravelRefill = PendingShopTravelRefill;
  type PaidOffer = PendingShopPaidOffer;
  type ShopExecution = {
    candidate: RewardBranchState;
    readonly witness: ShopGenerationWitness;
    remainingSlotIndexes: readonly number[];
    readonly travelActiveAtEntry: boolean;
    readonly goldActiveAtEntry?: import('../../authored-project/traits').EquippedTrait;
    firstNormalPurchaseSeen: boolean;
    travelRefill?: TravelRefill;
    goldMaterialization?: GoldMaterialization;
  };
  type GoldMaterialization = PendingShopGoldMaterialization;
  const executions: ShopExecution[] = [];
  for (const branch of branches) {
    const pending = branch.pendingShops[semanticAddressKey(room.origin)];
    if (pending?.profileKey !== profile.key) {
      return fail(
        `${room.gameName} lost its shop witness for ${JSON.stringify(order)}; pending=${JSON.stringify(Object.keys(branch.pendingShops))}`,
      );
    }
    executions.push({
      candidate: branch,
      witness: pending.witness,
      remainingSlotIndexes:
        pending.remainingSlotIndexes ?? Object.freeze(entry.offers.map((_, index) => index)),
      travelActiveAtEntry:
        pending.travelActiveAtEntry ??
        branch.traitHistory?.equippedTraits.RestockBoon !== undefined,
      ...(() => {
        if (pending.goldActiveAtEntry !== undefined) {
          return { goldActiveAtEntry: pending.goldActiveAtEntry };
        }
        const goldActiveAtEntry = Object.values(branch.traitHistory?.equippedTraits ?? {}).find(
          (equipped) => {
            const disposition = catalog.traits.byKey[equipped.traitKey]?.selectedDisposition;
            return disposition?.kind === 'echo' && disposition.effect === 'doubleShop';
          },
        );
        return goldActiveAtEntry === undefined ? {} : { goldActiveAtEntry };
      })(),
      firstNormalPurchaseSeen: pending.firstNormalPurchaseSeen ?? false,
      ...(pending.travelRefill === undefined ? {} : { travelRefill: pending.travelRefill }),
      ...(pending.goldMaterialization === undefined
        ? {}
        : { goldMaterialization: pending.goldMaterialization }),
    });
  }
  const branchCohortSize = executions.length;
  const contractDescriptor = declaration.infernalContractReward;
  const contractChild = room.acquisitionSites.roomExit?.entries[INFERNAL_CONTRACT_ENTRY_KEY];
  if (contractDescriptor !== undefined && contractChild !== undefined) {
    for (const execution of executions) {
      if (execution.candidate.traitHistory?.equippedTraits.InfernalContractBoon !== undefined) {
        const contractAddress = createAcquisitionEntryAddress(site, INFERNAL_CONTRACT_ENTRY_KEY);
        const routeContext = entry.offers.find(
          (offer) =>
            offer.traitContext?.weaponKey !== undefined &&
            offer.traitContext.aspectKey !== undefined,
        )?.traitContext;
        if (routeContext?.weaponKey === undefined || routeContext.aspectKey === undefined)
          return fail(`${room.gameName} Contract candidate frontier has no route loadout`);
        const branchesBeforeEntry = Object.freeze([execution.candidate]);
        derivedEntryFrontiers.push(
          Object.freeze({
            address: contractAddress,
            kind: 'infernalContractReward' as const,
            branchCohortSize,
            rewardTypes: contractDescriptor.rewardTypes,
            branchesBeforeEntry,
            evaluateOffer: (offer: ResolvedRewardOffer) => {
              if (!contractDescriptor.rewardTypes.includes(offer.rewardType))
                return Object.freeze({ findings: Object.freeze([]), supported: false });
              const candidate = createUnresolvedAcquisitionRewardState(catalog, offer, {
                kind: 'producerLifecycle',
                key: contractDescriptor.producerLifecycleKey,
              });
              const candidateFindings = new Map<string, FindingRegionEntry>();
              const settled = settleOwnedAcquisitionSite(
                catalog,
                branchesBeforeEntry,
                {
                  siteOwner: room.origin,
                  pointKey: 'roomExit',
                  entryKey: INFERNAL_CONTRACT_ENTRY_KEY,
                  source: Object.freeze({
                    origin: contractAddress,
                    offer: candidate.offer,
                    producerLifecycleKey: contractDescriptor.producerLifecycleKey,
                    producerKind: 'freeReward',
                    instanceProvenance: 'free',
                    traitOffersByAcquisitionRole: candidate.traitOffersByAcquisitionRole,
                    ...(candidate.levelResolutionsByAcquisitionRole === undefined
                      ? {}
                      : {
                          levelResolutionsByAcquisitionRole:
                            candidate.levelResolutionsByAcquisitionRole,
                        }),
                    dispositionByAcquisitionRole: candidate.dispositionByAcquisitionRole,
                    traitContext: Object.freeze({}),
                  }),
                  historySequence,
                  ...(context.authoredSeaStarDuplicateSiteKeys === undefined
                    ? {}
                    : {
                        authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
                      }),
                },
                context.facts,
                candidateFindings,
                ownerRegion(room.origin),
                context.findingChronology,
              );
              return Object.freeze({
                findings: Object.freeze(
                  [...candidateFindings.values()].map((entry) => entry.finding),
                ),
                supported: settled.branches.length === branchesBeforeEntry.length,
              });
            },
          }),
        );
      }
    }
  }
  const deriveTravelRefill = (
    execution: ShopExecution,
    sourceOffer: PaidOffer,
    slotIndex: number,
    excludedNames: ReadonlySet<string>,
  ): TravelRefill | undefined => {
    const slot = profile.slots.values[slotIndex];
    const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
    if (slot === undefined || group === undefined) return undefined;
    const generationFacts = context.facts(
      execution.candidate.history,
      new Set(),
      execution.candidate,
    );
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
              excludedPurchaseInteractionNames.size === 0
                ? {}
                : { excludedPurchaseInteractionNames },
            ).length > 0,
        ),
      );
    const excludedDomain = supportedOffers(excludedNames);
    const effectiveExcludedNames = excludedDomain.length > 0 ? excludedNames : new Set<string>();
    const domain = excludedDomain.length > 0 ? excludedDomain : supportedOffers(new Set());
    if (domain.length === 0) return undefined;
    const evaluateOffer = (offer: ResolvedRewardOffer) =>
      Object.freeze({
        findings: Object.freeze([]),
        supported:
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
          ).length > 0,
      });
    return Object.freeze({
      sourceOfferKey: sourceOffer.offerKey,
      slotIndex,
      rewardTypes: Object.freeze([...new Set(domain.map((offer) => offer.rewardType))]),
      excludedNames: effectiveExcludedNames,
      generationFacts,
      evaluateOffer,
    });
  };
  /**
   * Runtime-only item predicates never enter authored state.  Resolve the one
   * declared replacement at the exact generated slot, retaining the active
   * phase and source-pool witness for this action only.
   */
  const resolveShopRuntimeFallback = (
    slotIndex: number,
    option: ShopOptionEntry | undefined,
    generationFacts: ReturnType<typeof context.facts>,
    excludedPurchaseInteractionNames: ReadonlySet<string>,
  ): string | undefined => {
    if (option?.runtimeOfferFallbackRewardTypes === undefined) return undefined;
    const slot = profile.slots.values[slotIndex];
    const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
    if (group === undefined) return undefined;
    for (const rewardType of option.runtimeOfferFallbackRewardTypes) {
      const fallbackOption = group.options.values.find(
        (candidate) => candidate.rewardType === rewardType,
      );
      if (fallbackOption === undefined) continue;
      const active = locallyValidRewardOffers(catalog.rewards, rewardType).some((offer) =>
        findShopIndexedGenerationWitnesses(
          catalog.rewards,
          profile,
          slotIndex,
          offer,
          generationFacts,
          requirements,
          excludedPurchaseInteractionNames.size === 0 ? {} : { excludedPurchaseInteractionNames },
        ).some((witness) => witness.optionKeys[slotIndex] === fallbackOption.key),
      );
      if (active) return rewardType;
    }
    return undefined;
  };
  const goldDisposition = Object.values(catalog.traits.byKey).find(
    (trait) =>
      trait.selectedDisposition?.kind === 'echo' &&
      trait.selectedDisposition.effect === 'doubleShop',
  )?.selectedDisposition;
  const goldSourceEligible = (offer: ResolvedRewardOffer): boolean =>
    goldDisposition?.kind === 'echo' &&
    goldDisposition.effect === 'doubleShop' &&
    !goldDisposition.excludedRewardTypes.includes(offer.rewardType);
  const eligibleGoldSourceOfferKeys = (): readonly string[] => {
    const travel = room.acquisitionSites.roomExit?.entries[TRAVEL_DEAL_REFILL_ENTRY_KEY];
    return Object.freeze([
      ...entry.offers.flatMap((offer) => (goldSourceEligible(offer.offer) ? [offer.offerKey] : [])),
      ...(travel !== undefined && travel !== null && goldSourceEligible(travel.offer)
        ? [TRAVEL_DEAL_REFILL_ENTRY_KEY]
        : []),
    ]);
  };
  const materializeGold = (
    execution: ShopExecution,
    offer: PaidOffer,
    roleBindings: GoldMaterialization['roleBindings'],
  ): void => {
    if (execution.goldMaterialization !== undefined) return;
    const pending = execution.goldActiveAtEntry;
    const disposition =
      pending === undefined
        ? undefined
        : catalog.traits.byKey[pending.traitKey]?.selectedDisposition;
    if (
      pending === undefined ||
      pending.acquisitionIdentity === undefined ||
      disposition?.kind !== 'echo' ||
      disposition.effect !== 'doubleShop' ||
      disposition.excludedRewardTypes.includes(offer.offer.rewardType)
    )
      return;
    const address = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
    const before = execution.candidate;
    const beforeTraits = before.traitHistory ?? createTraitHistoryState();
    const traitHistory = foldTraitHistoryEvents(catalog, [
      ...beforeTraits.events,
      Object.freeze({
        kind: 'traitRemoval' as const,
        owner: address,
        acquisitionRole: 'echoShopDuplicateConsumed',
        sequence: historySequence,
        acquisitionPoint: 'shopDuplicateMaterialized',
        traitKey: pending.traitKey,
        acquisitionIdentity: pending.acquisitionIdentity,
        match: 'acquisitionIdentity' as const,
      }),
    ]);
    execution.candidate = Object.freeze({
      ...before,
      history: attachTraitHistory(before.history, traitHistory),
      traitHistory,
    });
    execution.goldMaterialization = Object.freeze({
      sourceOfferKey: offer.offerKey,
      roleBindings,
      sourceOffer: offer,
      sourceTraitHistory: beforeTraits,
      sourcePomEligibleTraitKeys: Object.freeze(
        Object.values(beforeTraits.equippedTraits)
          .filter((trait) => isPomUpgradeTarget(catalog, trait))
          .map((trait) => trait.traitKey),
      ),
    });
    const branchesBeforeEntry = Object.freeze([execution.candidate]);
    const duplicateOffer = echoShopDuplicateOffer(catalog, offer.offer);
    const fixedReward =
      duplicateOffer === null
        ? undefined
        : createUnresolvedShopAcquisitionRewardState(catalog, duplicateOffer, profile.key);
    const derivedRoleFrontiers: AcquisitionRoleFrontier[] = [];
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
        ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
      });
      const settlement = Object.freeze({ site, entry: address });
      let candidateBranches: readonly RewardBranchState[] = branchesBeforeEntry;
      for (const binding of roleBindings) {
        candidateBranches = applyProducerRoleHistory(
          catalog,
          candidateBranches,
          source,
          Object.freeze({ ...binding, historySequence }),
          context.facts,
          new Map(),
          ownerRegion(room.origin),
          context.findingChronology,
          settlement,
          derivedRoleFrontiers,
          undefined,
          branchesBeforeEntry,
          true,
          false,
          context.authoredSeaStarDuplicateSiteKeys,
        );
      }
    }
    derivedEntryFrontiers.push(
      Object.freeze({
        address,
        kind: 'echoDoubleShopReward' as const,
        branchCohortSize,
        sourceOfferKey: offer.offerKey,
        rewardTypes: Object.freeze([offer.offer.rewardType]),
        ...(fixedReward === undefined ? {} : { fixedReward }),
        ...(derivedRoleFrontiers.length === 0
          ? {}
          : { roleFrontiers: Object.freeze(derivedRoleFrontiers) }),
        eligibleSourceOfferKeys: eligibleGoldSourceOfferKeys(),
        branchesBeforeEntry,
        evaluateOffer: (candidateOffer: ResolvedRewardOffer) =>
          Object.freeze({
            findings: Object.freeze([]),
            supported: echoShopDuplicateOfferMatches(catalog, offer.offer, candidateOffer),
          }),
      }),
    );
  };

  const settlePaid = (
    execution: ShopExecution,
    offer: PaidOffer,
    roleBindings: readonly {
      readonly role: string;
      readonly lifecyclePoint: ProducerLifecyclePointKey;
    }[],
    agreementBranches: readonly RewardBranchState[],
  ): boolean => {
    let current = Object.freeze([execution.candidate]);
    const source: AcquisitionSource = withStoredArtificerReplacements(
      room,
      Object.freeze({
        origin: offer.offerOrigin,
        offer: offer.offer,
        producerLifecycleKey: profile.key,
        producerKind: 'shop',
        instanceProvenance: 'paid',
        ...(offer.traitOffersByAcquisitionRole === undefined
          ? {}
          : { traitOffersByAcquisitionRole: offer.traitOffersByAcquisitionRole }),
        ...(offer.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : { levelResolutionsByAcquisitionRole: offer.levelResolutionsByAcquisitionRole }),
        ...(offer.dispositionByAcquisitionRole === undefined
          ? {}
          : { dispositionByAcquisitionRole: offer.dispositionByAcquisitionRole }),
        ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
      }),
    );
    const settlement = Object.freeze({
      site,
      entry: createAcquisitionEntryAddress(site, offer.offerKey),
    });
    for (const binding of roleBindings) {
      recordRoles(offer.offerKey, [binding]);
      current = applyProducerRoleHistory(
        catalog,
        current,
        source,
        Object.freeze({ ...binding, historySequence }),
        context.facts,
        findings,
        ownerRegion(room.origin),
        context.findingChronology,
        settlement,
        roleFrontiers,
        traitChildSettlements,
        agreementBranches,
        true,
        false,
        context.authoredSeaStarDuplicateSiteKeys,
      );
    }
    if (current.length !== 1) return false;
    execution.candidate = current[0]!;
    return true;
  };

  for (const entryKey of order) {
    const agreementBranches = Object.freeze(executions.map(({ candidate }) => candidate));
    const survivors: ShopExecution[] = [];
    for (const execution of executions) {
      if (entryKey === INFERNAL_CONTRACT_ENTRY_KEY) {
        const descriptor = declaration.infernalContractReward;
        const child = room.acquisitionSites.roomExit?.entries[entryKey];
        if (
          descriptor === undefined ||
          child === undefined ||
          execution.candidate.traitHistory?.equippedTraits.InfernalContractBoon === undefined
        ) {
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'infernalContractUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (child === null) {
          addRewardFinding(
            findings,
            rewardFinding('rewardMissing', createAcquisitionEntryAddress(site, entryKey), {}),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const settled = settleOwnedAcquisitionSite(
          catalog,
          Object.freeze([execution.candidate]),
          {
            siteOwner: room.origin,
            pointKey: 'roomExit',
            entryKey,
            source: withStoredArtificerReplacements(
              room,
              Object.freeze({
                origin: createAcquisitionEntryAddress(site, entryKey),
                offer: child.offer,
                producerLifecycleKey: descriptor.producerLifecycleKey,
                producerKind: 'freeReward',
                instanceProvenance: 'free',
                traitOffersByAcquisitionRole: child.traitOffersByAcquisitionRole,
                ...(child.levelResolutionsByAcquisitionRole === undefined
                  ? {}
                  : { levelResolutionsByAcquisitionRole: child.levelResolutionsByAcquisitionRole }),
                dispositionByAcquisitionRole: child.dispositionByAcquisitionRole,
                traitContext: Object.freeze({}),
              }),
            ),
            historySequence,
            ...(context.authoredSeaStarDuplicateSiteKeys === undefined
              ? {}
              : {
                  authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
                }),
          },
          context.facts,
          findings,
          ownerRegion(room.origin),
          context.findingChronology,
        );
        roleFrontiers.push(...(settled.roleFrontiers ?? []));
        traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
        if (settled.branches.length === 1) {
          execution.candidate = settled.branches[0]!;
          survivors.push(execution);
        }
        continue;
      }

      if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) {
        const refill = execution.travelRefill;
        const authoredChild = room.acquisitionSites.roomExit?.entries[entryKey];
        const child = authoredChild;
        if (refill === undefined || child === undefined) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'travelDealRefillUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (child === null) {
          addRewardFinding(
            findings,
            rewardFinding('rewardMissing', createAcquisitionEntryAddress(site, entryKey), {}),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const support = findShopIndexedGenerationWitnesses(
          catalog.rewards,
          profile,
          refill.slotIndex,
          child.offer,
          refill.generationFacts,
          requirements,
          refill.excludedNames.size === 0
            ? {}
            : { excludedPurchaseInteractionNames: refill.excludedNames },
        );
        if (support.length === 0) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'travelDealRefillUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const slot = profile.slots.values[refill.slotIndex]!;
        const group = profile.groups.byKey[slot.groupKey]!;
        const witnessByRarityContext = new Map<string, ShopGenerationWitness>();
        for (const witness of support) {
          const optionKey = witness.optionKeys[refill.slotIndex];
          const option = optionKey === undefined ? undefined : group.options.byKey[optionKey];
          if (option !== undefined)
            witnessByRarityContext.set(JSON.stringify(option.boonRarityOverride ?? {}), witness);
        }
        for (const witness of witnessByRarityContext.values()) {
          const optionKey = witness.optionKeys[refill.slotIndex];
          const option = optionKey === undefined ? undefined : group.options.byKey[optionKey];
          if (option === undefined) continue;
          // A Travel Deal child is a fresh result at the same physical slot.
          // Its runtime contingency belongs to that generated child, not to
          // the option originally purchased to create the refill.
          const refillOption = group.options.values.find(
            (candidate) => candidate.rewardType === child.offer.rewardType,
          );
          const runtimeOfferFallbackRewardType = resolveShopRuntimeFallback(
            refill.slotIndex,
            refillOption,
            refill.generationFacts,
            refill.excludedNames,
          );
          const refillExecution: ShopExecution = {
            ...execution,
            witness,
            remainingSlotIndexes: Object.freeze([...execution.remainingSlotIndexes]),
          };
          const refillOffer = Object.freeze({
            offerKey: entryKey,
            offerOrigin: createAcquisitionEntryAddress(site, entryKey),
            offer: child.offer,
            traitOffersByAcquisitionRole: child.traitOffersByAcquisitionRole,
            ...(child.levelResolutionsByAcquisitionRole === undefined
              ? {}
              : { levelResolutionsByAcquisitionRole: child.levelResolutionsByAcquisitionRole }),
            dispositionByAcquisitionRole: child.dispositionByAcquisitionRole,
            traitContext: Object.freeze({
              ...(entry.offers[refill.slotIndex]?.traitContext ?? {}),
              ...(option.boonRarityOverride === undefined
                ? {}
                : { boonRarityItemOverride: option.boonRarityOverride }),
            }),
            ...(runtimeOfferFallbackRewardType === undefined
              ? {}
              : {
                  runtimeOfferFallbackRewardType,
                }),
          });
          if (runtimeOfferFallbackRewardType !== undefined)
            runtimeOfferFallbacks.push({
              address: refillOffer.offerOrigin,
              preferredRewardType: refillOffer.offer.rewardType,
              fallbackRewardType: runtimeOfferFallbackRewardType,
            });
          const bindings = option.acquisitionLifecycle.map((binding) =>
            Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
          );
          materializeGold(refillExecution, refillOffer, bindings);
          if (settlePaid(refillExecution, refillOffer, bindings, agreementBranches)) {
            survivors.push(refillExecution);
          }
        }
        continue;
      }

      if (entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY) {
        const materialization = execution.goldMaterialization;
        const authoredChild = room.acquisitionSites.roomExit?.entries[entryKey];
        const child = authoredChild;
        if (materialization === undefined || child === undefined) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'echoShopDuplicateUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (child === null) {
          addRewardFinding(
            findings,
            rewardFinding('rewardMissing', createAcquisitionEntryAddress(site, entryKey), {}),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (
          !echoShopDuplicateOfferMatches(catalog, materialization.sourceOffer.offer, child.offer)
        ) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              {
                kind: 'echoShopDuplicatePayload',
                sourceOfferKey: materialization.sourceOfferKey,
              },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const source = materialization.sourceOffer;
        const currentTraits = execution.candidate.traitHistory ?? createTraitHistoryState();
        const sourceTargetDisappeared = materialization.sourcePomEligibleTraitKeys.some(
          (traitKey) => currentTraits.equippedTraits[traitKey] === undefined,
        );
        const settled = settleOwnedAcquisitionSite(
          catalog,
          Object.freeze([execution.candidate]),
          {
            siteOwner: room.origin,
            pointKey: 'roomExit',
            entryKey,
            source: withStoredArtificerReplacements(
              room,
              Object.freeze({
                origin: createAcquisitionEntryAddress(site, entryKey),
                offer: child.offer,
                producerLifecycleKey: profile.key,
                producerKind: 'shop',
                instanceProvenance: 'free',
                traitOffersByAcquisitionRole: child.traitOffersByAcquisitionRole,
                ...(child.levelResolutionsByAcquisitionRole === undefined
                  ? {}
                  : { levelResolutionsByAcquisitionRole: child.levelResolutionsByAcquisitionRole }),
                levelResolutionGenerationHistory: sourceTargetDisappeared
                  ? currentTraits
                  : materialization.sourceTraitHistory,
                dispositionByAcquisitionRole: child.dispositionByAcquisitionRole,
                ...(source.traitContext === undefined ? {} : { traitContext: source.traitContext }),
              }),
            ),
            historySequence,
            roleBindings: materialization.roleBindings,
            deferArtificerReplacement: true,
            ...(context.authoredSeaStarDuplicateSiteKeys === undefined
              ? {}
              : {
                  authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
                }),
          },
          context.facts,
          findings,
          ownerRegion(room.origin),
          context.findingChronology,
        );
        roleFrontiers.push(...(settled.roleFrontiers ?? []));
        traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
        if (settled.branches.length === 1) {
          execution.candidate = settled.branches[0]!;
          survivors.push(execution);
        }
        continue;
      }

      const slotIndex = entry.offers.findIndex((offer) => offer.offerKey === entryKey);
      const offer = slotIndex < 0 ? undefined : entry.offers[slotIndex];
      if (offer === undefined)
        return fail(`${room.gameName} acquisition order has unknown entry ${entryKey}`);
      const purchase = evaluateShopPurchaseAtSlot(
        catalog.rewards,
        profile,
        authored,
        execution.witness,
        slotIndex,
        execution.remainingSlotIndexes,
        execution.candidate.history,
        context.facts(execution.candidate.history, new Set(), execution.candidate),
        requirements,
      );
      if (purchase === undefined) {
        entryPurchaseFailureRecorded = true;
        addRewardFinding(
          findings,
          rewardFinding('shopPurchaseUnavailable', createAcquisitionEntryAddress(site, entryKey), {
            kind: 'shopOfferPurchase',
            offerKey: entryKey,
          }),
          ownerRegion(room.origin),
          context.findingChronology ?? historyChronology(historySequence),
        );
        continue;
      }
      const bindings = purchase.acquisitions.map(({ event }) =>
        Object.freeze({ role: event.role, lifecyclePoint: event.lifecyclePoint }),
      );
      const optionKey = execution.witness.optionKeys[slotIndex];
      const shopOption =
        optionKey === undefined
          ? undefined
          : profile.groups.byKey[profile.slots.values[slotIndex]!.groupKey]?.options.byKey[
              optionKey
            ];
      const paidOffer =
        shopOption?.boonRarityOverride === undefined
          ? offer
          : Object.freeze({
              ...offer,
              traitContext: Object.freeze({
                ...(offer.traitContext ?? {}),
                boonRarityItemOverride: shopOption.boonRarityOverride,
              }),
            });
      const runtimeOfferFallbackRewardType = resolveShopRuntimeFallback(
        slotIndex,
        shopOption,
        context.facts(execution.candidate.history, new Set(), execution.candidate),
        new Set(),
      );
      const evaluatedPaidOffer =
        runtimeOfferFallbackRewardType === undefined
          ? paidOffer
          : Object.freeze({ ...paidOffer, runtimeOfferFallbackRewardType });
      if (runtimeOfferFallbackRewardType !== undefined)
        runtimeOfferFallbacks.push({
          address: offer.offerOrigin,
          preferredRewardType: offer.offer.rewardType,
          fallbackRewardType: runtimeOfferFallbackRewardType,
        });
      const prePurchaseTraits = execution.candidate.traitHistory;
      materializeGold(execution, evaluatedPaidOffer, bindings);
      if (!settlePaid(execution, evaluatedPaidOffer, bindings, agreementBranches)) continue;
      execution.remainingSlotIndexes = purchase.remainingSlotIndexes;
      if (!execution.firstNormalPurchaseSeen) {
        execution.firstNormalPurchaseSeen = true;
        if (
          execution.travelActiveAtEntry &&
          prePurchaseTraits?.equippedTraits.RestockBoon !== undefined
        ) {
          const slot = profile.slots.values[slotIndex]!;
          const optionKey = execution.witness.optionKeys[slotIndex];
          const option = profile.groups.byKey[slot.groupKey]?.options.byKey[optionKey ?? ''];
          const interaction =
            option === undefined ? undefined : purchaseInteractionName(option, offer.offer);
          const excludedNames = new Set<string>();
          if (interaction !== undefined) {
            excludedNames.add(interaction);
            excludedNames.add(`${interaction}Drop`);
          }
          const travelRefill = deriveTravelRefill(execution, offer, slotIndex, excludedNames);
          if (travelRefill !== undefined) {
            execution.travelRefill = travelRefill;
            const address = createAcquisitionEntryAddress(site, TRAVEL_DEAL_REFILL_ENTRY_KEY);
            const branchesBeforeEntry = Object.freeze([execution.candidate]);
            derivedEntryFrontiers.push(
              Object.freeze({
                address,
                kind: 'travelDealRefill' as const,
                branchCohortSize,
                sourceOfferKey: offer.offerKey,
                slotIndex,
                rewardTypes: travelRefill.rewardTypes,
                branchesBeforeEntry,
                evaluateOffer: travelRefill.evaluateOffer,
              }),
            );
          }
        }
      }
      survivors.push(execution);
    }
    executions.splice(0, executions.length, ...survivors);
  }

  for (const execution of executions) {
    if (execution.travelActiveAtEntry && execution.travelRefill === undefined) {
      derivedEntryFrontiers.push(
        Object.freeze({
          address: createAcquisitionEntryAddress(site, TRAVEL_DEAL_REFILL_ENTRY_KEY),
          kind: 'travelDealPlaceholder' as const,
          branchCohortSize,
          branchesBeforeEntry: Object.freeze([execution.candidate]),
        }),
      );
    }
    if (execution.goldActiveAtEntry !== undefined && execution.goldMaterialization === undefined) {
      derivedEntryFrontiers.push(
        Object.freeze({
          address: createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY),
          kind: 'echoDoubleShopPlaceholder' as const,
          branchCohortSize,
          eligibleSourceOfferKeys: eligibleGoldSourceOfferKeys(),
          branchesBeforeEntry: Object.freeze([execution.candidate]),
        }),
      );
    }
  }

  const next: RewardBranchState[] = [];
  for (const execution of executions) {
    const { candidate } = execution;
    const shopKey = semanticAddressKey(room.origin);
    if (context.completeAfterOrder === true || context.order === undefined) {
      const { [shopKey]: completed, ...remainingShops } = candidate.pendingShops;
      void completed;
      next.push(Object.freeze({ ...candidate, pendingShops: freezeRecord(remainingShops) }));
      continue;
    }
    next.push(
      Object.freeze({
        ...candidate,
        pendingShops: freezeRecord({
          ...candidate.pendingShops,
          [shopKey]: Object.freeze({
            profileKey: profile.key,
            witness: execution.witness,
            remainingSlotIndexes: execution.remainingSlotIndexes,
            travelActiveAtEntry: execution.travelActiveAtEntry,
            ...(execution.goldActiveAtEntry === undefined
              ? {}
              : { goldActiveAtEntry: execution.goldActiveAtEntry }),
            firstNormalPurchaseSeen: execution.firstNormalPurchaseSeen,
            ...(execution.travelRefill === undefined
              ? {}
              : { travelRefill: execution.travelRefill }),
            ...(execution.goldMaterialization === undefined
              ? {}
              : { goldMaterialization: execution.goldMaterialization }),
          }),
        }),
      }),
    );
  }
  const settlementFindings = [...findings].flatMap(([key, finding]) =>
    findingKeysBeforeSettlement.has(key) ? [] : [finding.finding],
  );
  const stoppedOnlyForMissingAuthorship =
    settlementFindings.length > 0 &&
    settlementFindings.every(isAcquisitionAuthorshipMissingFinding);
  if (next.length === 0 && !entryPurchaseFailureRecorded && !stoppedOnlyForMissingAuthorship) {
    addRewardFinding(
      findings,
      rewardFinding('shopPurchaseUnavailable', site, {
        kind: 'jointPurchaseOrder',
        offerKeys: context.order ?? [],
      }),
      ownerRegion(room.origin),
      context.findingChronology ?? historyChronology(historySequence),
    );
  }
  return Object.freeze({
    site,
    entries: Object.freeze(
      (context.order ?? []).map((offerKey) => {
        const offer = entry.offers.find((candidate) => candidate.offerKey === offerKey);
        if (offer === undefined) {
          const supplemental = room.acquisitionSites.roomExit?.entries[offerKey];
          const artificerReplacement = parseArtificerReplacementEntryKey(offerKey);
          if (
            supplemental === undefined &&
            offerKey !== TRAVEL_DEAL_REFILL_ENTRY_KEY &&
            offerKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY &&
            artificerReplacement === undefined
          )
            return fail(`${room.gameName} acquisition order has unknown entry ${offerKey}`);
          return Object.freeze({
            address: createAcquisitionEntryAddress(site, offerKey),
            source: createAcquisitionEntryAddress(
              site,
              artificerReplacement?.sourceKey ?? offerKey,
            ),
            acquisitionRoles: rolesByOfferKey.get(offerKey) ?? Object.freeze([]),
            participation: 'optional' as const,
          });
        }
        const acquisitionRoles = rolesByOfferKey.get(offer.offerKey) ?? [];
        return Object.freeze({
          address: createAcquisitionEntryAddress(site, offer.offerKey),
          source: offer.offerOrigin,
          acquisitionRoles,
          participation: 'optional' as const,
        });
      }),
    ),
    branches: mergeEquivalentRewardBranches(next),
    roleFrontiers: Object.freeze(roleFrontiers),
    derivedEntryFrontiers: Object.freeze(derivedEntryFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
    runtimeOfferFallbacks: Object.freeze(runtimeOfferFallbacks),
  });
}

/** Closes a generated Shop witness after the room's final chronology action. */
export function completePendingShopAcquisitionSite(
  branches: readonly RewardBranchState[],
  owner: SemanticAddress,
  fail: (detail: string) => never,
): readonly RewardBranchState[] {
  const shopKey = semanticAddressKey(owner);
  const pendingCount = branches.filter(
    (branch) => branch.pendingShops[shopKey] !== undefined,
  ).length;
  if (pendingCount === 0) return branches;
  if (pendingCount !== branches.length) {
    return fail(`${semanticAddressKey(owner)} has a divergent pending Shop frontier`);
  }
  return Object.freeze(
    branches.map((branch) => {
      const { [shopKey]: completed, ...remainingShops } = branch.pendingShops;
      void completed;
      return Object.freeze({ ...branch, pendingShops: freezeRecord(remainingShops) });
    }),
  );
}
