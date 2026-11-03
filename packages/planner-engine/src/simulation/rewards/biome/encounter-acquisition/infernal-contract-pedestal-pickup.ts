import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
} from '../../../../authored-project/addresses';
import {
  INFERNAL_CONTRACT_ENTRY_KEY,
  INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
} from '../../../../authored-project/infernal-contract-pedestal';
import { rewardSourceResolvesAtAcquisition } from '../../../../authored-project/acquisition/reward-state';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  addRewardFinding,
  historyChronology,
  mergeRewardFindingEmissions,
  rewardFinding,
} from '../../findings';
import type { RewardBranchState } from '../../branch-primitives';
import {
  settleAcquisitionResolvedReward,
  settleOwnedAcquisitionSite,
  withRoomStoredSourceProducts,
} from '../../acquisition/site-settlement';
import type {
  AcquisitionRoleFrontier,
  DerivedAcquisitionEntryFrontier,
  RewardFactsFactory,
} from '../../acquisition/contracts';
import type { ReachedTraitChildCheckpoint } from '../../trait-settlement/coordinator';
import { reachedOfferForOrigin } from '../../offer-generation';
import type { FindingChronology } from '../../../finding-regions';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import {
  createAuthoredSiteSettlementEmissions,
  type AuthoredSiteSettlementEmissions,
} from '../generation/emissions';

export interface InfernalContractPedestalPickup {
  readonly branch: RewardBranchState | undefined;
  readonly emissions: AuthoredSiteSettlementEmissions;
}

/**
 * Collects the pedestal's free item. It settles like a Shop item outside any
 * Shop: free, from its own pool, never Sea Star-duplicated, and only when
 * the pedestal spawned in the reached state.
 */
export function settleInfernalContractPedestalPickup(inputs: {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly sourceBranch: RewardBranchState | undefined;
  readonly historySequence: number;
  readonly facts: RewardFactsFactory;
  readonly findingChronology?: FindingChronology;
  readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
}): InfernalContractPedestalPickup {
  const { catalog, room, declaration, sourceBranch: branch, historySequence, facts } = inputs;
  const findingChronology = inputs.findingChronology ?? historyChronology(historySequence);
  const site = createAcquisitionSiteAddress(room.origin, INFERNAL_CONTRACT_PEDESTAL_SITE_KEY);
  const entry = createAcquisitionEntryAddress(site, INFERNAL_CONTRACT_ENTRY_KEY);
  const region = ownerRegion(entry);
  const findings = new Map<string, FindingRegionEntry>();
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const derivedEntryFrontiers: DerivedAcquisitionEntryFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const pedestal = room.infernalContractPedestal;
  const descriptor = declaration.infernalContractReward;
  const timelineOwner = room.roomActionRoster.rows.find(
    (row) =>
      !row.stale && row.rank !== null && row.reference.kind === 'interactInfernalContractPedestal',
  )?.owner;
  const unavailable = () =>
    addRewardFinding(
      findings,
      rewardFinding('rewardSourceUnavailable', entry, { reason: 'infernalContractNotHeld' }),
      region,
      findingChronology,
    );
  const result = (settled: RewardBranchState | undefined) =>
    Object.freeze({
      branch: settled,
      emissions: createAuthoredSiteSettlementEmissions({
        acquisitionRoleFrontiers: roleFrontiers,
        derivedEntryFrontiers,
        traitChildSettlements,
        findings,
      }),
    });
  if (pedestal === undefined || pedestal === null || descriptor === undefined) {
    if (branch !== undefined) unavailable();
    return result(undefined);
  }
  const bindings =
    catalog.rewards.producerLifecycles.byKey[descriptor.producerLifecycleKey]?.rewardTypes.byKey[
      pedestal.offer.rewardType
    ]?.acquisitionLifecycle;
  if (bindings === undefined)
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} Contract item lacks its declared acquisition lifecycle`,
    );
  const producerLifecycleKey = descriptor.generationProfileKey;
  const acquisitionResolved = rewardSourceResolvesAtAcquisition(catalog, pedestal.offer);
  if (branch === undefined) return result(undefined);
  if (reachedOfferForOrigin(branch, pedestal.offerOrigin) === undefined) {
    unavailable();
    return result(undefined);
  }
  const request = Object.freeze({
    siteOwner: room.origin,
    pointKey: INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
    entryKey: INFERNAL_CONTRACT_ENTRY_KEY,
    historySequence,
    roleBindings: bindings,
    directTraitAgreementBranch: branch,
    ...(timelineOwner === undefined ? {} : { timelineOwner }),
    ...(inputs.authoredSeaStarDuplicateSiteKeys === undefined
      ? {}
      : { authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys }),
  });
  const settled = acquisitionResolved
    ? settleAcquisitionResolvedReward(
        catalog,
        branch,
        {
          ...request,
          visibleOffer: pedestal.offer,
          reward:
            room.acquisitionSites[INFERNAL_CONTRACT_PEDESTAL_SITE_KEY]?.entries[
              INFERNAL_CONTRACT_ENTRY_KEY
            ],
          producerLifecycleKey,
          producerKind: 'shop',
          instanceProvenance: 'free',
          blocksSeaStarDuplication: true,
          presentsMaterializedScreen: true,
          ...(pedestal.traitContext === undefined ? {} : { traitContext: pedestal.traitContext }),
        },
        facts,
        region,
        findingChronology,
      )
    : settleOwnedAcquisitionSite(
        catalog,
        branch,
        {
          ...request,
          source: withRoomStoredSourceProducts(
            catalog,
            room,
            Object.freeze({
              origin: pedestal.offerOrigin,
              offer: pedestal.offer,
              producerLifecycleKey,
              producerKind: 'shop' as const,
              instanceProvenance: 'free' as const,
              blocksSeaStarDuplication: true as const,
              // The item stands on its own store screen.
              presentsMaterializedScreen: true,
              ...(pedestal.traitOffersByAcquisitionRole === undefined
                ? {}
                : { traitOffersByAcquisitionRole: pedestal.traitOffersByAcquisitionRole }),
              ...(pedestal.levelResolutionsByAcquisitionRole === undefined
                ? {}
                : {
                    levelResolutionsByAcquisitionRole: pedestal.levelResolutionsByAcquisitionRole,
                  }),
              ...(pedestal.anvilResultsByAcquisitionRole === undefined
                ? {}
                : { anvilResultsByAcquisitionRole: pedestal.anvilResultsByAcquisitionRole }),
              ...(pedestal.hexActivationsByAcquisitionRole === undefined
                ? {}
                : {
                    hexActivationsByAcquisitionRole: pedestal.hexActivationsByAcquisitionRole,
                  }),
              ...(pedestal.dispositionByAcquisitionRole === undefined
                ? {}
                : { dispositionByAcquisitionRole: pedestal.dispositionByAcquisitionRole }),
              ...(pedestal.traitContext === undefined
                ? {}
                : { traitContext: pedestal.traitContext }),
              ...(timelineOwner === undefined ? {} : { timelineOwner }),
            }),
          ),
          deferArtificerReplacement: true,
        },
        facts,
        region,
        findingChronology,
      );
  mergeRewardFindingEmissions(findings, settled.findingEmissions);
  derivedEntryFrontiers.push(...(settled.derivedEntryFrontiers ?? []));
  roleFrontiers.push(...(settled.roleFrontiers ?? []));
  traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
  return result(settled.branch);
}
