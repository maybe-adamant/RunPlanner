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
  const producerBlocksDuplication =
    catalog.rewards.producerLifecycles.byKey[source.producerLifecycleKey]?.duplicationExempt ===
    true;
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
    blocksSeaStarDuplication: source.blocksSeaStarDuplication === true || producerBlocksDuplication,
  });
  return Object.freeze({
    supported:
      seaStarActive &&
      acquisition?.canDuplicate === true &&
      source.instanceProvenance === 'free' &&
      source.blocksSeaStarDuplication !== true &&
      !producerBlocksDuplication &&
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
  // The Artificer converts only while Barren has not unequipped its card.
  const status = branch.state.arcanaFear.arcana.active.some(
    (card) => card.unequipped === true && card.key === 'MetaToRunUpgrade',
  )
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
  readonly generatedReplacement?: {
    readonly branch: RewardBranchState;
    readonly source: AcquisitionSource;
    readonly roles: readonly AcquisitionSettlementRole[];
  };
  readonly findingEmissions: readonly FindingRegionEntry[];
  /**
   * An unavailable conversion is one the game cannot make: it blocks at its
   * role, and the source is neither converted nor acquired normally.
   */
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
  let generatedReplacement: ArtificerGenerationProduct['generatedReplacement'];
  const result = (status: ArtificerGenerationProduct['status']): ArtificerGenerationProduct =>
    Object.freeze({
      ...(generatedReplacement === undefined ? {} : { generatedReplacement }),
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
  const arcanaFear = artificer.supported
    ? consumeArtificerUse(catalog, branch.state.arcanaFear, {
        owner: incoming.origin,
        acquisitionRole: resolution.role,
        sequence: resolution.historySequence,
        roleOrdinal:
          catalog.rewards.rewardTypes.byKey[
            incoming.offer.rewardType
          ]?.acquisitionRoles.values.findIndex((role) => role.key === resolution.role) ?? 0,
      })
    : undefined;
  if (
    arcanaFear !== undefined &&
    replacementLifecycle !== undefined &&
    runProgress !== undefined &&
    prepared !== undefined
  ) {
    const bag = consumeCountedOffer(
      catalog.rewards,
      runProgress,
      prepared.bag,
      artificerReplacement.offer,
      facts(prepared.branch.state),
      { ineligibleRewardTypes: new Set(['Devotion', 'SpellDrop']) },
    );
    if (bag !== undefined) {
      const generatedHistory = applyOfferProjection(
        catalog.rewards,
        prepared.branch.state.rewardHistory,
        artificerReplacement.offer,
        facts(prepared.branch.state),
      );
      const withBagAndUse = Object.freeze({
        ...prepared.branch,
        state: Object.freeze({
          ...prepared.branch.state,
          bags: freezeRecord({ ...prepared.branch.state.bags, RunProgress: bag }),
          rewardHistory: generatedHistory,
          arcanaFear,
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
      generatedReplacement = Object.freeze({
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
          ...(artificerReplacement.hexActivationsByAcquisitionRole === undefined
            ? {}
            : {
                hexActivationsByAcquisitionRole:
                  artificerReplacement.hexActivationsByAcquisitionRole,
              }),
          dispositionByAcquisitionRole: artificerReplacement.dispositionByAcquisitionRole,
          // A generated replacement stands on the screen its source presented.
          presentsMaterializedScreen: incoming.presentsMaterializedScreen,
          traitContext: incoming.traitContext,
          ...(incoming.timelineOwner === undefined
            ? {}
            : { timelineOwner: incoming.timelineOwner }),
          ...(incoming.blocksSeaStarDuplication === true || !sourceCanDuplicate
            ? { blocksSeaStarDuplication: true as const }
            : {}),
        }),
        roles: replacementLifecycle.acquisitionLifecycle,
      });
      return result('converted');
    }
  }
  addRewardFinding(
    findingEmissions,
    rewardFinding(
      arcanaFear !== undefined
        ? 'artificerReplacementUnavailable'
        : 'artificerConversionUnavailable',
      createAcquisitionRoleAddress(incoming.origin, resolution.role),
      { ...artificer.evidence, replacement: offerEvidence(artificerReplacement.offer) },
    ),
    atomicRegion,
    findingChronology ?? historyChronology(resolution.historySequence),
  );
  return result('unavailable');
}
