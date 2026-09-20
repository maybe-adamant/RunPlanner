import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createShopOfferAddress,
  createBiomeAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../authored-project/addresses';

import { parseArtificerReplacementEntryKey } from '../../../authored-project/acquisition/artificer';
import { rewardSourceResolvesAtAcquisition } from '../../../authored-project/acquisition/reward-state';

import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOfferMatches,
  echoShopDuplicateRequiresPickup,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../../authored-project/shop';
import {
  evaluateShopPurchaseGateAtSlot,
  purchaseInteractionName,
  type ProducerLifecyclePointKey,
  type ShopGenerationWitness,
} from '../../../reward-kernel';

import { isAcquisitionAuthorshipMissingFinding } from '../../model';
import { ownerRegion, type FindingRegionEntry } from '../../finding-regions';

import {
  freezeRecord,
  mergeEquivalentRewardBranches,
  type RewardBranchState,
} from '../branch-primitives';
import type { PendingShopGoldMaterialization, PendingShopPaidOffer } from '../../state/model';
import { type ReachedTraitChildCheckpoint } from '../trait-settlement/coordinator';
import {
  addRewardFinding,
  historyChronology,
  mergeRewardFindingEmissions,
  rewardFinding,
} from '../findings';
import { EMPTY_PLANNER_TIMELINE_FACTS } from '../../timeline-facts';

import {
  withStoredArtificerReplacements,
  settleAcquisitionResolvedReward,
  settleOwnedAcquisitionSite,
} from '../acquisition/site-settlement';
import type {
  AcquisitionRoleFrontier,
  AcquisitionSettlementProduct,
  DerivedAcquisitionEntryFrontier,
} from '../acquisition/contracts';
import type { AcquisitionSource } from '../acquisition/source';
import { shopRequirements, type ShopProcessingContext } from './context';
import {
  deriveTravelRefill,
  eligibleShopGoldSourceOfferKeys,
  materializeShopGold,
  type ShopTravelRefillProduct,
} from './derived-rewards';

/** Settles optional Shop offer entries at the exact post-outgoing roomExit site. */
export function settleShopAcquisitionSite(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
): AcquisitionSettlementProduct {
  const findings = new Map<string, FindingRegionEntry>();
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') return fail(`${room.gameName} applied missing shop purchases`);
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) return fail(`unknown shop profile ${entry.profileKey}`);
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
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
  const site = createAcquisitionSiteAddress(room.origin, 'roomExit');
  const actionOwnerForOffer = (offerKey: string): SemanticAddress | undefined =>
    room.roomActionRoster.rows.find(
      (row) =>
        !row.stale &&
        row.rank !== null &&
        (row.reference.kind === 'interactShopOffer'
          ? row.reference.offerKey === offerKey
          : row.reference.kind === 'interactAcquisitionEntry' &&
            row.reference.siteKey === 'roomExit' &&
            row.reference.entryKey === offerKey),
    )?.owner;
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const goldPickupPlaced = room.roomActions.order.some(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.siteKey === 'roomExit' &&
      reference.entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  );
  const derivedEntryFrontiers: DerivedAcquisitionEntryFrontier[] = [];
  let entryPurchaseFailureRecorded = false;
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
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
  type TravelRefill = ShopTravelRefillProduct;
  type PaidOffer = PendingShopPaidOffer;
  type ShopExecution = {
    candidate: RewardBranchState;
    readonly witness: ShopGenerationWitness;
    remainingSlotIndexes: readonly number[];
    readonly travelActiveAtEntry: boolean;
    readonly goldActiveAtEntry?: import('../../../authored-project/traits/state').EquippedTrait;
    firstNormalPurchaseSeen: boolean;
    travelRefill?: TravelRefill;
    goldMaterialization?: GoldMaterialization;
    contractOffer?: import('../../materialization').CanonicalShopOffer;
  };
  type GoldMaterialization = PendingShopGoldMaterialization;
  const executions: ShopExecution[] = [];
  for (const branch of branches) {
    const pending = branch.state.pendingShops[semanticAddressKey(room.origin)];
    if (pending?.profileKey !== profile.key) {
      return fail(
        `${room.gameName} lost its shop witness for ${JSON.stringify(order)}; pending=${JSON.stringify(Object.keys(branch.state.pendingShops))}`,
      );
    }
    const capability =
      branch.pendingShopContinuations[semanticAddressKey(room.origin)]?.travelRefill;
    if (pending.travelRefill !== undefined && capability === undefined)
      return fail(`${room.gameName} lost its Travel Deal continuation`);
    executions.push({
      candidate: branch,
      witness: pending.witness,
      remainingSlotIndexes:
        pending.remainingSlotIndexes ?? Object.freeze(entry.offers.map((_, index) => index)),
      travelActiveAtEntry:
        pending.travelActiveAtEntry ??
        branch.state.traitHistory.equippedTraits.RestockBoon !== undefined,
      ...(() => {
        if (pending.goldActiveAtEntry !== undefined) {
          return { goldActiveAtEntry: pending.goldActiveAtEntry };
        }
        const goldActiveAtEntry = Object.values(
          branch.state.traitHistory.equippedTraits ?? {},
        ).find((equipped) => {
          const disposition = catalog.traits.byKey[equipped.traitKey]?.selectedDisposition;
          return disposition?.kind === 'echo' && disposition.effect === 'doubleShop';
        });
        return goldActiveAtEntry === undefined ? {} : { goldActiveAtEntry };
      })(),
      firstNormalPurchaseSeen: pending.firstNormalPurchaseSeen ?? false,
      ...(pending.travelRefill === undefined
        ? {}
        : {
            travelRefill: { data: pending.travelRefill, capability: capability! },
          }),
      ...(pending.goldMaterialization === undefined
        ? {}
        : { goldMaterialization: pending.goldMaterialization }),
      ...(pending.infernalContractOffer === undefined
        ? {}
        : { contractOffer: pending.infernalContractOffer }),
    });
  }
  const branchCohortSize = executions.length;
  const eligibleGoldSourceOfferKeys = (): readonly string[] => {
    const travel = entry.travelDealRefill;
    return eligibleShopGoldSourceOfferKeys(
      catalog,
      entry.offers,
      travel === undefined || travel === null
        ? travel
        : Object.freeze({ offerKey: TRAVEL_DEAL_REFILL_ENTRY_KEY, offer: travel.offer }),
    );
  };
  const settleOffer = (
    execution: ShopExecution,
    offer: PaidOffer,
    shopProfileKey: string,
    instanceProvenance: 'free' | 'paid',
    roleBindings: readonly {
      readonly role: string;
      readonly lifecyclePoint: ProducerLifecyclePointKey;
    }[],
    agreementBranches: readonly RewardBranchState[],
  ): boolean => {
    const purchaseActionOwner = actionOwnerForOffer(offer.offerKey);
    const source: AcquisitionSource = withStoredArtificerReplacements(
      room,
      Object.freeze({
        origin: offer.offerOrigin,
        offer: offer.offer,
        producerLifecycleKey: shopProfileKey,
        producerKind: 'shop',
        instanceProvenance,
        blocksSeaStarDuplication: true as const,
        ...(offer.traitOffersByAcquisitionRole === undefined
          ? {}
          : { traitOffersByAcquisitionRole: offer.traitOffersByAcquisitionRole }),
        ...(offer.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : { levelResolutionsByAcquisitionRole: offer.levelResolutionsByAcquisitionRole }),
        ...(offer.anvilResult === undefined ? {} : { anvilResult: offer.anvilResult }),
        ...(offer.dispositionByAcquisitionRole === undefined
          ? {}
          : { dispositionByAcquisitionRole: offer.dispositionByAcquisitionRole }),
        ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
        ...(purchaseActionOwner === undefined ? {} : { timelineOwner: purchaseActionOwner }),
      }),
    );
    const request = Object.freeze({
      siteOwner: room.origin,
      pointKey: 'roomExit',
      entryKey: offer.offerKey,
      historySequence,
      roleBindings,
      directTraitAgreementBranches: agreementBranches,
      ...(purchaseActionOwner === undefined ? {} : { timelineOwner: purchaseActionOwner }),
      ...(context.authoredSeaStarDuplicateSiteKeys === undefined
        ? {}
        : { authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys }),
    });
    const current = Object.freeze([execution.candidate]);
    const settled = rewardSourceResolvesAtAcquisition(catalog, offer.offer)
      ? settleAcquisitionResolvedReward(
          catalog,
          current,
          {
            ...request,
            visibleOffer: offer.offer,
            reward: room.acquisitionSites.roomExit?.entries[offer.offerKey],
            producerLifecycleKey: shopProfileKey,
            producerKind: 'shop',
            instanceProvenance,
            blocksSeaStarDuplication: true,
            ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
            branchCohortSize,
          },
          context.facts,
          ownerRegion(room.origin),
          context.findingChronology,
        )
      : settleOwnedAcquisitionSite(
          catalog,
          current,
          { ...request, source, deferArtificerReplacement: true },
          context.facts,
          ownerRegion(room.origin),
          context.findingChronology,
        );
    mergeRewardFindingEmissions(findings, settled.findingEmissions);
    derivedEntryFrontiers.push(...(settled.derivedEntryFrontiers ?? []));
    roleFrontiers.push(...(settled.roleFrontiers ?? []));
    traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
    for (const settledEntry of settled.entries)
      recordRoles(offer.offerKey, settledEntry.acquisitionRoles);
    if (settled.branches.length !== 1) return false;
    execution.candidate = settled.branches[0]!;
    return true;
  };

  for (const entryKey of order) {
    // Hidden sources belong to the actual duplicate pickup, not its creation.
    if (entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY) {
      for (let index = derivedEntryFrontiers.length - 1; index >= 0; index -= 1) {
        const frontier = derivedEntryFrontiers[index]!;
        if (frontier.kind === 'echoDoubleShopReward' && frontier.fixedReward === undefined)
          derivedEntryFrontiers.splice(index, 1);
      }
    }
    const agreementBranches = Object.freeze(executions.map(({ candidate }) => candidate));
    const survivors: ShopExecution[] = [];
    for (const execution of executions) {
      if (entryKey === INFERNAL_CONTRACT_ENTRY_KEY) {
        const descriptor = declaration.infernalContractReward;
        if (descriptor === undefined || execution.contractOffer === undefined) {
          entryPurchaseFailureRecorded = true;
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
        const bindings =
          catalog.rewards.producerLifecycles.byKey[descriptor.producerLifecycleKey]?.rewardTypes
            .byKey[execution.contractOffer.offer.rewardType]?.acquisitionLifecycle;
        if (bindings === undefined)
          return fail(`${room.gameName} Contract item lacks its declared acquisition lifecycle`);
        if (
          settleOffer(
            execution,
            execution.contractOffer,
            descriptor.generationProfileKey,
            'free',
            bindings,
            agreementBranches,
          )
        )
          survivors.push(execution);
        continue;
      }

      if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) {
        const refill = execution.travelRefill;
        const inventory = entry.travelDealRefill;
        if (refill === undefined || inventory === undefined || inventory === null) {
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
        const slot = profile.slots.values[refill.data.slotIndex]!;
        const group = profile.groups.byKey[slot.groupKey]!;
        const exactOption =
          inventory.optionKey === null ? undefined : group.options.byKey[inventory.optionKey];
        if (
          exactOption === undefined ||
          exactOption.rewardType !== inventory.offer.rewardType ||
          !refill.capability.evaluateShopOption({
            optionKey: exactOption.key,
            offer: inventory.offer,
          }).supported
        ) {
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
        {
          const option = exactOption;
          const refillExecution: ShopExecution = {
            ...execution,
            remainingSlotIndexes: Object.freeze([...execution.remainingSlotIndexes]),
          };
          const refillOffer = Object.freeze({
            ...inventory,
            offerKey: entryKey,
            offerOrigin: inventory.offerOrigin,
            optionKey: exactOption.key,
            traitContext: Object.freeze({
              ...(inventory.traitContext ?? {}),
              ...(option.boonRarityOverride === undefined
                ? {}
                : { boonRarityItemOverride: option.boonRarityOverride }),
            }),
          });
          const bindings = option.acquisitionLifecycle.map((binding) =>
            Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
          );
          const gold = materializeShopGold({
            catalog,
            branch: refillExecution.candidate,
            pendingGold: refillExecution.goldActiveAtEntry,
            existingMaterialization: refillExecution.goldMaterialization,
            pickupPlaced: goldPickupPlaced,
            authoredOffer:
              room.acquisitionSites.roomExit?.entries[ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY]?.offer,
            sourceOffer: refillOffer,
            roleBindings: bindings,
            profile,
            site,
            owner: room.origin,
            actionOwner: actionOwnerForOffer(refillOffer.offerKey),
            branchCohortSize,
            historySequence,
            facts: context.facts,
            findingChronology: context.findingChronology,
            authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
            eligibleSourceOfferKeys: eligibleGoldSourceOfferKeys(),
          });
          refillExecution.candidate = gold.branch;
          if (gold.materialization !== undefined)
            refillExecution.goldMaterialization = gold.materialization;
          derivedEntryFrontiers.push(...gold.derivedEntryFrontiers);
          if (
            settleOffer(
              refillExecution,
              refillOffer,
              profile.key,
              'paid',
              bindings,
              agreementBranches,
            )
          ) {
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
        if (rewardSourceResolvesAtAcquisition(catalog, materialization.sourceOffer.offer)) {
          const settled = settleAcquisitionResolvedReward(
            catalog,
            Object.freeze([execution.candidate]),
            {
              siteOwner: room.origin,
              pointKey: 'roomExit',
              entryKey,
              visibleOffer: materialization.sourceOffer.offer,
              reward: child,
              producerLifecycleKey: profile.key,
              producerKind: 'shop',
              instanceProvenance: 'free',
              blocksSeaStarDuplication: true,
              roleBindings: materialization.roleBindings,
              ...(materialization.sourceOffer.traitContext === undefined
                ? {}
                : { traitContext: materialization.sourceOffer.traitContext }),
              historySequence,
              branchCohortSize,
              ...(actionOwnerForOffer(entryKey) === undefined
                ? {}
                : { timelineOwner: actionOwnerForOffer(entryKey)! }),
            },
            context.facts,
            ownerRegion(room.origin),
            context.findingChronology,
          );
          mergeRewardFindingEmissions(findings, settled.findingEmissions);
          roleFrontiers.push(...(settled.roleFrontiers ?? []));
          traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
          derivedEntryFrontiers.push(
            ...(settled.derivedEntryFrontiers ?? []).map((frontier) =>
              Object.freeze({
                ...frontier,
                kind: 'echoDoubleShopReward' as const,
                sourceOfferKey: materialization.sourceOfferKey,
                eligibleSourceOfferKeys: eligibleGoldSourceOfferKeys(),
                participation: 'optional' as const,
                retainedSourceMismatch:
                  child !== null &&
                  !echoShopDuplicateOfferMatches(
                    catalog,
                    materialization.sourceOffer.offer,
                    child.offer,
                  ),
              }),
            ),
          );
          if (settled.branches.length === 1) {
            execution.candidate = settled.branches[0]!;
            survivors.push(execution);
          } else if (settled.findingEmissions.length > 0) {
            entryPurchaseFailureRecorded = true;
          }
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
        const currentTraits = execution.candidate.state.traitHistory;
        const sourceTargetDisappeared = materialization.sourcePomEligibleTraitKeys.some(
          (traitKey) => currentTraits.equippedTraits[traitKey] === undefined,
        );
        const duplicateActionOwner = actionOwnerForOffer(entryKey);
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
                ...(duplicateActionOwner === undefined
                  ? {}
                  : { timelineOwner: duplicateActionOwner }),
              }),
            ),
            historySequence,
            roleBindings: materialization.roleBindings,
            ...(duplicateActionOwner === undefined ? {} : { timelineOwner: duplicateActionOwner }),
            deferArtificerReplacement: true,
            ...(context.authoredSeaStarDuplicateSiteKeys === undefined
              ? {}
              : {
                  authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
                }),
          },
          context.facts,
          ownerRegion(room.origin),
          context.findingChronology,
        );
        mergeRewardFindingEmissions(findings, settled.findingEmissions);
        roleFrontiers.push(...(settled.roleFrontiers ?? []));
        traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
        if (settled.branches.length === 1) {
          execution.candidate = settled.branches[0]!;
          survivors.push(execution);
        }
        continue;
      }

      const slotIndex = entry.offers.findIndex((offer) => offer.offerKey === entryKey);
      const inventoryOffer = slotIndex < 0 ? undefined : entry.offers[slotIndex];
      if (inventoryOffer === undefined)
        return fail(`${room.gameName} acquisition order has unknown entry ${entryKey}`);

      const purchase = evaluateShopPurchaseGateAtSlot(
        profile,
        execution.witness,
        slotIndex,
        execution.remainingSlotIndexes,
        execution.candidate.state.rewardHistory,
        context.facts(execution.candidate.state, new Set()),
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
      const bindings = purchase.acquisitionLifecycle;
      const optionKey = execution.witness.optionKeys[slotIndex];
      const shopOption =
        optionKey === undefined
          ? undefined
          : profile.groups.byKey[profile.slots.values[slotIndex]!.groupKey]?.options.byKey[
              optionKey
            ];
      const paidOffer: PaidOffer =
        shopOption?.boonRarityOverride === undefined
          ? inventoryOffer
          : Object.freeze({
              ...inventoryOffer,
              traitContext: Object.freeze({
                ...(inventoryOffer.traitContext ?? {}),
                boonRarityItemOverride: shopOption.boonRarityOverride,
              }),
            });
      const prePurchaseTraits = execution.candidate.state.traitHistory;
      const gold = materializeShopGold({
        catalog,
        branch: execution.candidate,
        pendingGold: execution.goldActiveAtEntry,
        existingMaterialization: execution.goldMaterialization,
        pickupPlaced: goldPickupPlaced,
        authoredOffer:
          room.acquisitionSites.roomExit?.entries[ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY]?.offer,
        sourceOffer: paidOffer,
        roleBindings: bindings,
        profile,
        site,
        owner: room.origin,
        actionOwner: actionOwnerForOffer(paidOffer.offerKey),
        branchCohortSize,
        historySequence,
        facts: context.facts,
        findingChronology: context.findingChronology,
        authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
        eligibleSourceOfferKeys: eligibleGoldSourceOfferKeys(),
      });
      execution.candidate = gold.branch;
      if (gold.materialization !== undefined) execution.goldMaterialization = gold.materialization;
      derivedEntryFrontiers.push(...gold.derivedEntryFrontiers);
      if (!settleOffer(execution, paidOffer, profile.key, 'paid', bindings, agreementBranches)) {
        entryPurchaseFailureRecorded = true;
        continue;
      }
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
            option === undefined
              ? undefined
              : purchaseInteractionName(option, inventoryOffer.offer);
          const excludedNames = new Set<string>();
          if (interaction !== undefined) {
            excludedNames.add(interaction);
            excludedNames.add(`${interaction}Drop`);
          }
          const travelRefill = deriveTravelRefill({
            catalog,
            profile,
            branch: execution.candidate,
            sourceOffer: inventoryOffer,
            slotIndex,
            excludedNames,
            requirements,
            facts: context.facts,
          });
          if (travelRefill !== undefined) {
            execution.travelRefill = travelRefill;
            const address = createAcquisitionEntryAddress(site, TRAVEL_DEAL_REFILL_ENTRY_KEY);
            const inventoryOwner = createShopOfferAddress(
              createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
              room.origin.occurrenceId,
              TRAVEL_DEAL_REFILL_ENTRY_KEY,
            );
            const branchesBeforeEntry = Object.freeze([execution.candidate]);
            derivedEntryFrontiers.push(
              Object.freeze({
                address,
                inventoryOwner,
                kind: 'travelDealRefill' as const,
                branchCohortSize,
                sourceOfferKey: inventoryOffer.offerKey,
                slotIndex,
                rewardTypes: travelRefill.data.rewardTypes,
                branchesBeforeEntry,
                evaluateOffer: travelRefill.capability.evaluateOffer,
                evaluateShopOption: travelRefill.capability.evaluateShopOption,
              }),
            );
            const inventory = entry.travelDealRefill;
            if (
              inventory == null ||
              inventory.optionKey === null ||
              !travelRefill.capability.evaluateShopOption({
                optionKey: inventory.optionKey,
                offer: inventory.offer,
              }).supported
            ) {
              addRewardFinding(
                findings,
                inventory == null
                  ? rewardFinding('rewardMissing', inventoryOwner, {})
                  : rewardFinding('shopPurchaseUnavailable', inventoryOwner, {
                      kind: 'travelDealRefillUnavailable',
                    }),
                ownerRegion(room.origin),
                context.findingChronology ?? historyChronology(historySequence),
              );
            }
          }
        }
      }
      survivors.push(execution);
    }
    executions.splice(0, executions.length, ...survivors);
  }

  for (const execution of executions) {
    if (
      (context.completeAfterOrder === true || context.order === undefined) &&
      !goldPickupPlaced &&
      execution.goldMaterialization !== undefined &&
      echoShopDuplicateRequiresPickup(catalog, execution.goldMaterialization.sourceOffer.offer)
    ) {
      addRewardFinding(
        findings,
        rewardFinding(
          'echoGoldPickupPlacementRequired',
          createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY),
          {},
        ),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
    if (execution.travelActiveAtEntry && execution.travelRefill === undefined) {
      derivedEntryFrontiers.push(
        Object.freeze({
          address: createAcquisitionEntryAddress(site, TRAVEL_DEAL_REFILL_ENTRY_KEY),
          inventoryOwner: createShopOfferAddress(
            createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
            room.origin.occurrenceId,
            TRAVEL_DEAL_REFILL_ENTRY_KEY,
          ),
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
      next.push(closeShop(candidate, shopKey));
      continue;
    }
    next.push(
      Object.freeze({
        ...candidate,
        pendingShopContinuations: freezeRecord({
          ...candidate.pendingShopContinuations,
          [shopKey]: Object.freeze(
            execution.travelRefill === undefined
              ? {}
              : {
                  travelRefill: execution.travelRefill.capability,
                },
          ),
        }),
        state: Object.freeze({
          ...candidate.state,
          pendingShops: freezeRecord({
            ...candidate.state.pendingShops,
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
                : { travelRefill: execution.travelRefill.data }),
              ...(execution.goldMaterialization === undefined
                ? {}
                : { goldMaterialization: execution.goldMaterialization }),
              ...(execution.contractOffer === undefined
                ? {}
                : { infernalContractOffer: execution.contractOffer }),
            }),
          }),
        }),
      }),
    );
  }
  const settlementFindings = [...findings.values()].map((finding) => finding.finding);
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
          const contract =
            offerKey === INFERNAL_CONTRACT_ENTRY_KEY ? entry.infernalContractOffer : undefined;
          if (contract !== undefined && contract !== null) {
            const acquisitionResolved = rewardSourceResolvesAtAcquisition(catalog, contract.offer);
            return Object.freeze({
              address: createAcquisitionEntryAddress(site, offerKey),
              source: acquisitionResolved
                ? createAcquisitionEntryAddress(site, offerKey)
                : contract.offerOrigin,
              acquisitionRoles: rolesByOfferKey.get(offerKey) ?? Object.freeze([]),
              participation: 'optional' as const,
            });
          }
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
        const acquisitionResolved = rewardSourceResolvesAtAcquisition(catalog, offer.offer);
        return Object.freeze({
          address: createAcquisitionEntryAddress(site, offer.offerKey),
          source: acquisitionResolved
            ? createAcquisitionEntryAddress(site, offer.offerKey)
            : offer.offerOrigin,
          acquisitionRoles,
          participation: 'optional' as const,
        });
      }),
    ),
    branches: mergeEquivalentRewardBranches(next),
    findingEmissions: Object.freeze([...findings.values()]),
    roleFrontiers: Object.freeze(roleFrontiers),
    derivedEntryFrontiers: Object.freeze(derivedEntryFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
    timelineFacts: EMPTY_PLANNER_TIMELINE_FACTS,
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
    (branch) => branch.state.pendingShops[shopKey] !== undefined,
  ).length;
  if (pendingCount === 0) return branches;
  if (pendingCount !== branches.length) {
    return fail(`${semanticAddressKey(owner)} has a divergent pending Shop frontier`);
  }
  return Object.freeze(branches.map((branch) => closeShop(branch, shopKey)));
}

function closeShop(branch: RewardBranchState, shopKey: string): RewardBranchState {
  const { [shopKey]: completed, ...pendingShops } = branch.state.pendingShops;
  const { [shopKey]: continuation, ...pendingShopContinuations } = branch.pendingShopContinuations;
  void completed;
  void continuation;
  return Object.freeze({
    ...branch,
    state: Object.freeze({ ...branch.state, pendingShops: freezeRecord(pendingShops) }),
    pendingShopContinuations: freezeRecord(pendingShopContinuations),
  });
}
