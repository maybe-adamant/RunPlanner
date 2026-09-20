import {
  createAcquisitionRoleAddress,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
} from '../../../authored-project/addresses';
import type { Catalog } from '../../../catalog-schema';
import {
  applyOfferProjection,
  consumeCountedOffer,
  resolveAcquisitionRole,
  type ConcreteAcquisitionEvent,
  type RewardBagState,
} from '../../../reward-kernel';
import { consumeArtificerUse } from '../../arcana-fear';
import {
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../../finding-regions';

import {
  appendRewardEvent,
  freezeRecord,
  offerEvidence,
  withBag,
  type RewardBranchState,
} from '../branch-primitives';
import { addRewardFinding, historyChronology, rewardFinding } from '../findings';
import type { AcquisitionRoleResolution, RewardFactsFactory } from './contracts';

import { resolvedAcquisitionSource, type AcquisitionSource } from './source';

import type { SemanticAddress } from '../../../authored-project/addresses';
import type { ProducerLifecyclePointKey } from '../../../reward-kernel';
import { artificerStatus } from '../../arcana-fear';
import type { FindingEvidence } from '../../model';
import { hasActiveChaosSemanticTag } from '../../traits';
import type { AcquisitionSettlementRole } from './contracts';

export function hasArtificerUse(
  branch: RewardBranchState,
  owner: SemanticAddress,
  acquisitionRole: string,
): boolean {
  return branch.state.arcanaFear.arcana.artificerUses.some(
    (use) =>
      semanticAddressKey(use.owner) === semanticAddressKey(owner) &&
      use.acquisitionRole === acquisitionRole,
  );
}

/** Exact Sea Star question at the captured pre-acquisition role frontier. */
export function assessSeaStarDuplication(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  resolution: AcquisitionSettlementRole,
  resolvedAcquisition?: ConcreteAcquisitionEvent,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const resolved =
    resolvedAcquisition ??
    resolveAcquisitionRole(
      catalog.rewards,
      source.offer,
      resolution.role,
      resolution.lifecyclePoint,
    );
  const acquisition = catalog.rewards.acquisitions.byKey[resolved.acquisition.gameName];
  const seaStarActive = branch.state.traitHistory.equippedTraits.DoubleRewardBoon !== undefined;
  const evidence = Object.freeze({
    ...offerEvidence(source.offer),
    role: resolution.role,
    lifecyclePoint: resolution.lifecyclePoint,
    canDuplicate: acquisition?.canDuplicate === true,
    seaStarActive,
    instanceProvenance: source.instanceProvenance,
    normalDisposition:
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'timePiece' &&
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'artificer',
    blocksSeaStarDuplication: source.blocksSeaStarDuplication === true,
  });
  return Object.freeze({
    supported:
      seaStarActive &&
      acquisition?.canDuplicate === true &&
      source.instanceProvenance === 'free' &&
      source.blocksSeaStarDuplication !== true &&
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'timePiece' &&
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'artificer',
    evidence,
  });
}

/**
 * Shared Time Piece legality.  Settlement, progressive candidates, and the
 * persisted-value finding all ask this exact question at the frozen role
 * frontier; no consumer replays reward settlement to rediscover it.
 */
export function assessTimePieceConversion(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  role: string,
  lifecyclePoint: ProducerLifecyclePointKey,
  resolvedAcquisition?: ConcreteAcquisitionEvent,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const acquisition =
    resolvedAcquisition ??
    resolveAcquisitionRole(catalog.rewards, source.offer, role, lifecyclePoint);
  const blocksGoldConversion =
    catalog.rewards.rewardTypes.byKey[source.offer.rewardType]?.acquisitionRoles.byKey[role]
      ?.blocksGoldConversion === true;
  const goldConversionEligible =
    catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.goldConversionEligible ===
    true;
  const remainingCharges = branch.state.keepsakes.timePiece?.remainingCharges ?? 0;
  const evidence = Object.freeze({
    ...offerEvidence(source.offer),
    role,
    lifecyclePoint,
    goldConversionEligible,
    blocksGoldConversion,
    instanceProvenance: source.instanceProvenance,
    fatedStatus: branch.state.keepsakes.fatedStatus,
    remainingCharges,
  });
  return Object.freeze({
    supported:
      goldConversionEligible &&
      !blocksGoldConversion &&
      source.instanceProvenance === 'free' &&
      branch.state.keepsakes.fatedStatus === 'Fated' &&
      remainingCharges > 0,
    evidence,
  });
}

export function assessArtificerConversion(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  resolution: AcquisitionSettlementRole,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const acquisition = resolveAcquisitionRole(
    catalog.rewards,
    source.offer,
    resolution.role,
    resolution.lifecyclePoint,
  );
  const artificerConversionEligible =
    catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]
      ?.artificerConversionEligible === true;
  const status = hasActiveChaosSemanticTag(branch.state.traitHistory, 'Barren')
    ? undefined
    : artificerStatus(catalog, branch.state.arcanaFear);
  const evidence = Object.freeze({
    ...offerEvidence(source.offer),
    role: resolution.role,
    lifecyclePoint: resolution.lifecyclePoint,
    artificerConversionEligible,
    blocksArtificerConversion: resolution.blocksArtificerConversion === true,
    instanceProvenance: source.instanceProvenance,
    ...(status === undefined ? {} : { artificerRarity: status.rarity }),
    artificerCapacity: status?.capacity ?? 0,
    artificerSpent: status?.spent ?? 0,
    artificerRemaining: status?.remaining ?? 0,
  });
  return Object.freeze({
    supported:
      artificerConversionEligible &&
      resolution.blocksArtificerConversion !== true &&
      source.instanceProvenance === 'free' &&
      status !== undefined &&
      status.remaining > 0,
    evidence,
  });
}

export interface ArtificerGenerationProduct {
  readonly generatedReplacements: readonly {
    readonly branch: RewardBranchState;
    readonly source: AcquisitionSource;
    readonly roles: readonly AcquisitionSettlementRole[];
  }[];
  readonly findingEmissions: readonly FindingRegionEntry[];
  /** Unavailable conversions retain ordinary acquisition repair evidence. */
  readonly status: 'missing' | 'converted' | 'unavailable';
}

export function generateArtificerReplacement(
  catalog: Catalog,
  branch: RewardBranchState,
  incoming: AcquisitionSource,
  resolution: AcquisitionRoleResolution,
  acquisition: ConcreteAcquisitionEvent,
  artificerReplacementAddress: AcquisitionEntryAddress,
  facts: RewardFactsFactory,
  atomicRegion: string | undefined,
  findingChronology: FindingChronology | undefined,
  settlement: { readonly site: AcquisitionSiteAddress; readonly entry: AcquisitionEntryAddress },
): ArtificerGenerationProduct {
  const findingEmissions = new Map<string, FindingRegionEntry>();
  const generatedReplacements: ArtificerGenerationProduct['generatedReplacements'][number][] = [];
  const result = (status: ArtificerGenerationProduct['status']): ArtificerGenerationProduct =>
    Object.freeze({
      generatedReplacements: Object.freeze(generatedReplacements),
      findingEmissions: Object.freeze([...findingEmissions.values()]),
      status,
    });
  const artificerReplacement =
    incoming.artificerReplacementByAcquisitionRole?.[resolution.role] ?? null;
  if (artificerReplacement === null) {
    addRewardFinding(
      findingEmissions,
      rewardFinding('rewardMissing', artificerReplacementAddress, {
        acquisitionRole: resolution.role,
        lifecyclePoint: resolution.lifecyclePoint,
      }),
      ownerRegion(artificerReplacementAddress),
      findingChronology ?? historyChronology(resolution.historySequence),
    );
    return result('missing');
  }
  const artificer = assessArtificerConversion(catalog, branch, incoming, resolution);
  const replacementAddress = artificerReplacementAddress;
  const replacementLifecycle =
    catalog.rewards.producerLifecycles.byKey.RoomReward?.rewardTypes.byKey[
      artificerReplacement.offer.rewardType
    ];
  const runProgress = catalog.rewards.stores.byKey.RunProgress;
  const prepared = withBag(catalog, branch, 'RunProgress');
  if (
    artificer.supported &&
    replacementLifecycle !== undefined &&
    runProgress !== undefined &&
    prepared !== undefined
  ) {
    let bags: readonly RewardBagState[] = Object.freeze([]);
    try {
      bags = consumeCountedOffer(
        catalog.rewards,
        runProgress,
        prepared.bag,
        artificerReplacement.offer,
        facts(prepared.branch.state.rewardHistory, undefined, prepared.branch),
        { ineligibleRewardTypes: new Set(['Devotion', 'SpellDrop']) },
      );
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('one-refill eligibility invariant')))
        throw error;
    }
    for (const bag of bags) {
      const arcanaFear = consumeArtificerUse(catalog, branch.state.arcanaFear, {
        owner: incoming.origin,
        acquisitionRole: resolution.role,
        sequence: resolution.historySequence,
        roleOrdinal:
          catalog.rewards.rewardTypes.byKey[
            incoming.offer.rewardType
          ]?.acquisitionRoles.values.findIndex((role) => role.key === resolution.role) ?? 0,
      });
      if (arcanaFear === undefined) {
        addRewardFinding(
          findingEmissions,
          rewardFinding(
            'artificerConversionUnavailable',
            createAcquisitionRoleAddress(incoming.origin, resolution.role),
            { ...artificer.evidence, replacement: offerEvidence(artificerReplacement.offer) },
          ),
          atomicRegion,
          findingChronology ?? historyChronology(resolution.historySequence),
        );
        continue;
      }
      const generatedHistory = applyOfferProjection(
        catalog.rewards,
        prepared.branch.state.rewardHistory,
        artificerReplacement.offer,
        facts(prepared.branch.state.rewardHistory, undefined, prepared.branch),
      );
      const withBagAndUse = Object.freeze({
        ...prepared.branch,
        state: Object.freeze({
          ...prepared.branch.state,
          bags: freezeRecord({ ...prepared.branch.state.bags, RunProgress: bag }),
          rewardHistory: generatedHistory,
          arcanaFear: arcanaFear,
        }),
      });
      const generated = appendRewardEvent(
        appendRewardEvent(withBagAndUse, resolution.historySequence, {
          kind: 'rewardOffered',
          origin: replacementAddress,
          offer: artificerReplacement.offer,
          storeKey: 'RunProgress',
        }),
        resolution.historySequence,
        {
          kind: 'artificerConversion',
          origin: incoming.origin,
          source: resolvedAcquisitionSource(incoming),
          acquisition,
          replacement: artificerReplacement.offer,
          settlement,
        },
      );
      const sourceCanDuplicate =
        catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.canDuplicate === true;
      generatedReplacements.push(
        Object.freeze({
          branch: generated,
          source: Object.freeze({
            origin: replacementAddress,
            offer: artificerReplacement.offer,
            producerLifecycleKey: 'RoomReward',
            producer: Object.freeze({
              kind: 'artificerReplacement' as const,
              sourceOwner: incoming.origin,
              ...(incoming.timelineOwner === undefined
                ? {}
                : { sourceTimelineOwner: incoming.timelineOwner }),
              sourceRole: resolution.role,
            }),
            instanceProvenance: 'free',
            roomRewardForfeitEligible: true as const,
            traitOffersByAcquisitionRole: artificerReplacement.traitOffersByAcquisitionRole,
            ...(artificerReplacement.levelResolutionsByAcquisitionRole === undefined
              ? {}
              : {
                  levelResolutionsByAcquisitionRole:
                    artificerReplacement.levelResolutionsByAcquisitionRole,
                }),
            dispositionByAcquisitionRole: artificerReplacement.dispositionByAcquisitionRole,
            traitContext: incoming.traitContext,
            ...(incoming.timelineOwner === undefined
              ? {}
              : { timelineOwner: incoming.timelineOwner }),
            ...(incoming.blocksSeaStarDuplication === true || !sourceCanDuplicate
              ? { blocksSeaStarDuplication: true as const }
              : {}),
          }),
          roles: replacementLifecycle.acquisitionLifecycle,
        }),
      );
    }
    if (bags.length > 0) return result('converted');
  }
  addRewardFinding(
    findingEmissions,
    rewardFinding(
      artificer.supported ? 'artificerReplacementUnavailable' : 'artificerConversionUnavailable',
      createAcquisitionRoleAddress(incoming.origin, resolution.role),
      { ...artificer.evidence, replacement: offerEvidence(artificerReplacement.offer) },
    ),
    atomicRegion,
    findingChronology ?? historyChronology(resolution.historySequence),
  );
  return result('unavailable');
}
