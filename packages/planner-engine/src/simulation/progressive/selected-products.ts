import {
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionRoleAddress,
  type FigurineArcanaAddress,
  type JudgmentArcanaAddress,
  type KeepsakeEquipResultAddress,
  type KeepsakeSelectionAddress,
  type LevelResolutionAddress,
  type NaturalSelectionResultAddress,
  type NemesisRandomEventAddress,
  type OccurrenceAddress,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TranscendentEmbryoOutcomeAddress,
  type TargetAddress,
  type TraitOfferAddress,
} from '../../authored-project/addresses';
import type { OrdinaryBatchGenerationAssessment } from '../generation';
import {
  createBiomeCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  type BiomeCandidateArtifacts,
  type DerivedAcquisitionEntryCandidateArtifacts,
  type SteadyGrowthCandidateArtifacts,
  type TranscendentEmbryoCandidateArtifacts,
} from '../candidate-artifacts';
import type { TraitOfferCandidateArtifacts } from '../candidates/trait-offer-capability';
import type { TraitChildSettlementCheckpoints } from '../rewards/biome';
import { findingIdentityKey, type FindingRegionEntry } from '../finding-regions';
import type { BiomeRewardSimulation } from '../rewards';
import type { EncounterCandidateArtifacts } from '../encounters/candidates';
import type { MaterializedBiomePrefix } from '../materialization';
import type {
  RewardProducerCandidateArtifacts,
  RewardProducerOwnerAddress,
} from '../rewards/producer-frontiers';
import type { SelectedTraitOfferAssessment } from '../trait-offers';
import {
  acquisitionRoleAncestor,
  derivedAcquisitionEntryAncestor,
  type BlockedAncestorChain,
  type LocatedFinding,
  type ProgressiveBiomeSelectedProducts,
} from './finding-location';
import type { BiomeGenerationValidation } from './products';

export function retainBlockedRegionProducts(
  retainedRewards: BiomeRewardSimulation,
  retainedArtifacts: BiomeCandidateArtifacts,
  blockedArtifacts: BiomeCandidateArtifacts,
  selectedRewards: BiomeRewardSimulation,
  selectedArtifacts: BiomeCandidateArtifacts,
  selectedTraitChildSettlements: TraitChildSettlementCheckpoints,
  ancestors: BlockedAncestorChain,
  blockedAt: SemanticAddress,
  blockedRegionKey: string,
  selectedFindingRegions: readonly FindingRegionEntry[],
  frontierSettlementOwner: OccurrenceAddress | undefined,
  retainedOrdinaryBatches: readonly OrdinaryBatchGenerationAssessment[],
): { readonly rewards: BiomeRewardSimulation; readonly artifacts: BiomeCandidateArtifacts } {
  const blockedTraitAt: TraitOfferAddress | undefined =
    blockedAt.kind === 'traitOffer'
      ? blockedAt
      : blockedAt.kind === 'naturalSelectionResult'
        ? blockedAt.trait
        : blockedAt.kind === 'traitAcquisitionTarget' ||
            blockedAt.kind === 'circeResolution' ||
            blockedAt.kind === 'echoPomTarget' ||
            blockedAt.kind === 'echoLastRunBoon' ||
            blockedAt.kind === 'echoLastReward'
          ? blockedAt.trait
          : undefined;
  const blockedLevelAt: LevelResolutionAddress | undefined =
    blockedAt.kind === 'levelResolution' ? blockedAt : undefined;
  const blockedJudgmentAt: JudgmentArcanaAddress | undefined =
    blockedAt.kind === 'judgmentArcana' ? blockedAt : undefined;
  const blockedFigurineAt: FigurineArcanaAddress | undefined =
    blockedAt.kind === 'figurineArcana' ? blockedAt : undefined;
  const blockedSteadyGrowthAt: SteadyGrowthOutcomeAddress | undefined =
    blockedAt.kind === 'steadyGrowthOutcome' ? blockedAt : undefined;
  const blockedTranscendentEmbryoAt: TranscendentEmbryoOutcomeAddress | undefined =
    blockedAt.kind === 'transcendentEmbryoOutcome' ? blockedAt : undefined;
  const blockedNemesisAt: NemesisRandomEventAddress | undefined =
    blockedAt.kind === 'nemesisRandomEvent' ? blockedAt : undefined;
  const blockedKeepsakeAt: KeepsakeSelectionAddress | undefined =
    blockedAt.kind === 'keepsakeSelection' ? blockedAt : undefined;
  const blockedKeepsakeEquipResultAt: KeepsakeEquipResultAddress | undefined =
    blockedAt.kind === 'keepsakeEquipResult' ? blockedAt : undefined;
  const blockedAcquisitionAt = acquisitionRoleAncestor(blockedAt);
  const blockedDerivedAcquisitionAt = derivedAcquisitionEntryAncestor(blockedAt);
  const blockedKey = blockedTraitAt === undefined ? undefined : semanticAddressKey(blockedTraitAt);
  const blockedTraitCapabilityAddress:
    TraitOfferAddress | NaturalSelectionResultAddress | undefined =
    blockedAt.kind === 'naturalSelectionResult' ? blockedAt : blockedTraitAt;
  const selectedOfferPrefix: SelectedTraitOfferAssessment[] = [];
  if (blockedKey !== undefined) {
    for (const offer of selectedRewards.selectedTraitOffers) {
      selectedOfferPrefix.push(offer);
      if (semanticAddressKey(offer.address) === blockedKey) break;
    }
  }
  const retainedOfferKeys = new Set(
    retainedRewards.selectedTraitOffers.map((offer) => semanticAddressKey(offer.address)),
  );
  const selectedTraitOffers = Object.freeze([
    ...retainedRewards.selectedTraitOffers,
    ...selectedOfferPrefix.filter(
      (offer) => !retainedOfferKeys.has(semanticAddressKey(offer.address)),
    ),
  ]);
  const blockedRewardFindings = Object.freeze(
    selectedFindingRegions
      .filter((entry) => entry.atomicRegion === blockedRegionKey && entry.aggregate === 'reward')
      .map((entry) => entry.finding),
  );
  const blockedChildSettlement = selectedTraitChildSettlements.at(blockedAt);
  const retainedRunStateKeys = new Set(
    retainedRewards.runStateSnapshots.map((snapshot) => semanticAddressKey(snapshot.owner)),
  );
  const runStateSnapshots = Object.freeze([
    ...retainedRewards.runStateSnapshots,
    ...(blockedChildSettlement?.runStateSnapshots ?? []).filter(
      (snapshot) => !retainedRunStateKeys.has(semanticAddressKey(snapshot.owner)),
    ),
  ]);
  const retainedLevelFindingKeys = new Set(
    [...retainedRewards.findings, ...blockedRewardFindings]
      .filter((finding) => finding.origin.kind === 'levelResolution')
      .map((finding) => semanticAddressKey(finding.origin)),
  );
  const blockedLevelKey =
    blockedLevelAt === undefined ? undefined : semanticAddressKey(blockedLevelAt);
  const selectedLevelResolutionPrefix = selectedRewards.selectedLevelResolutions.filter(
    (resolution) => {
      const key = semanticAddressKey(resolution.address);
      return key === blockedLevelKey || retainedLevelFindingKeys.has(key);
    },
  );
  const retainedLevelKeys = new Set(
    retainedRewards.selectedLevelResolutions.map((resolution) =>
      semanticAddressKey(resolution.address),
    ),
  );
  const selectedLevelResolutions = Object.freeze([
    ...retainedRewards.selectedLevelResolutions,
    ...selectedLevelResolutionPrefix.filter(
      (resolution) => !retainedLevelKeys.has(semanticAddressKey(resolution.address)),
    ),
  ]);
  const retainedFindingKeys = new Set(
    retainedRewards.findings.map((finding) => findingIdentityKey(finding)),
  );
  const rewardFindings = Object.freeze([
    ...retainedRewards.findings,
    ...blockedRewardFindings.filter((finding) => {
      const key = findingIdentityKey(finding);
      if (retainedFindingKeys.has(key)) return false;
      retainedFindingKeys.add(key);
      return true;
    }),
  ]);
  // A room-exit acquisition child is assessed after the source room's outgoing
  // checkpoint. When that child is the progressive blocker, the clamped
  // execution prefix intentionally stops at the outgoing frontier, but the
  // selected attempt has already produced the bounded settlement result. Keep
  // that exact post-settlement branch product visible at the frontier; it is
  // the current room's state, not a replay of later topology.
  const settledCurrentSiteBranches =
    ancestors.occurrenceOwner === undefined ||
    frontierSettlementOwner === undefined ||
    semanticAddressKey(ancestors.occurrenceOwner) !== semanticAddressKey(frontierSettlementOwner) ||
    blockedAt.kind !== 'levelResolution'
      ? undefined
      : selectedRewards.branches.some((branch) =>
            branch.events.some(
              (event) =>
                event.kind === 'concreteAcquisition' &&
                event.settlement !== undefined &&
                semanticAddressKey(event.settlement.site.owner) ===
                  semanticAddressKey(ancestors.occurrenceOwner!),
            ),
          )
        ? selectedRewards.branches
        : undefined;
  const blockedCapability =
    blockedTraitCapabilityAddress === undefined
      ? undefined
      : (selectedArtifacts.traitOffers.at(blockedTraitCapabilityAddress) ??
        blockedArtifacts.traitOffers.at(blockedTraitCapabilityAddress));
  const retainedTraitKeys = new Set(
    selectedTraitOffers.map((offer) => semanticAddressKey(offer.address)),
  );
  const traitOffers: TraitOfferCandidateArtifacts = Object.freeze({
    at: (
      address:
        | TraitOfferAddress
        | import('../../authored-project/addresses').NaturalSelectionResultAddress,
    ) => {
      const key = semanticAddressKey(address);
      return blockedTraitCapabilityAddress !== undefined &&
        key === semanticAddressKey(blockedTraitCapabilityAddress) &&
        blockedCapability !== undefined
        ? blockedCapability
        : retainedTraitKeys.has(key)
          ? retainedArtifacts.traitOffers.at(address)
          : undefined;
    },
  });
  const selectedLevelKeys = new Set(
    selectedLevelResolutionPrefix.map((resolution) => semanticAddressKey(resolution.address)),
  );
  const levelResolutions = Object.freeze({
    at: (address: LevelResolutionAddress) => {
      const key = semanticAddressKey(address);
      if (!selectedLevelKeys.has(key)) return retainedArtifacts.levelResolutions.at(address);
      return (
        selectedArtifacts.levelResolutions.at(address) ??
        blockedArtifacts.levelResolutions.at(address) ??
        retainedArtifacts.levelResolutions.at(address)
      );
    },
  });
  const blockedJudgmentCapability =
    blockedJudgmentAt === undefined
      ? undefined
      : (selectedArtifacts.judgmentArcana.at(blockedJudgmentAt) ??
        blockedArtifacts.judgmentArcana.at(blockedJudgmentAt));
  const judgmentArcana =
    blockedJudgmentAt === undefined || blockedJudgmentCapability === undefined
      ? retainedArtifacts.judgmentArcana
      : Object.freeze({
          at: (address: JudgmentArcanaAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedJudgmentAt)
              ? blockedJudgmentCapability
              : retainedArtifacts.judgmentArcana.at(address),
        });
  const blockedFigurineCapability =
    blockedFigurineAt === undefined
      ? undefined
      : (selectedArtifacts.figurineArcana.at(blockedFigurineAt) ??
        blockedArtifacts.figurineArcana.at(blockedFigurineAt));
  const figurineArcana =
    blockedFigurineAt === undefined || blockedFigurineCapability === undefined
      ? retainedArtifacts.figurineArcana
      : Object.freeze({
          at: (address: FigurineArcanaAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedFigurineAt)
              ? blockedFigurineCapability
              : retainedArtifacts.figurineArcana.at(address),
        });
  const blockedSteadyGrowthCapability =
    blockedSteadyGrowthAt === undefined
      ? undefined
      : (selectedArtifacts.steadyGrowth.at(blockedSteadyGrowthAt) ??
        blockedArtifacts.steadyGrowth.at(blockedSteadyGrowthAt));
  const steadyGrowth: SteadyGrowthCandidateArtifacts =
    blockedSteadyGrowthAt === undefined || blockedSteadyGrowthCapability === undefined
      ? retainedArtifacts.steadyGrowth
      : Object.freeze({
          at: (address: SteadyGrowthOutcomeAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedSteadyGrowthAt)
              ? blockedSteadyGrowthCapability
              : retainedArtifacts.steadyGrowth.at(address),
        });
  const blockedTranscendentEmbryoCapability =
    blockedTranscendentEmbryoAt === undefined
      ? undefined
      : (selectedArtifacts.transcendentEmbryo.at(blockedTranscendentEmbryoAt) ??
        blockedArtifacts.transcendentEmbryo.at(blockedTranscendentEmbryoAt));
  const transcendentEmbryo: TranscendentEmbryoCandidateArtifacts =
    blockedTranscendentEmbryoAt === undefined || blockedTranscendentEmbryoCapability === undefined
      ? retainedArtifacts.transcendentEmbryo
      : Object.freeze({
          at: (address: TranscendentEmbryoOutcomeAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedTranscendentEmbryoAt)
              ? blockedTranscendentEmbryoCapability
              : retainedArtifacts.transcendentEmbryo.at(address),
        });
  const blockedKeepsakeCapability =
    blockedKeepsakeAt === undefined
      ? undefined
      : (selectedArtifacts.keepsakeSelections.at(blockedKeepsakeAt) ??
        blockedArtifacts.keepsakeSelections.at(blockedKeepsakeAt));
  const keepsakeSelections =
    blockedKeepsakeAt === undefined || blockedKeepsakeCapability === undefined
      ? retainedArtifacts.keepsakeSelections
      : createKeepsakeSelectionCandidateArtifacts(
          new Map([
            ...retainedArtifacts.keepsakeSelections.entries(),
            [semanticAddressKey(blockedKeepsakeAt), blockedKeepsakeCapability] as const,
          ]),
        );
  const blockedKeepsakeEquipResultCapability =
    blockedKeepsakeEquipResultAt === undefined
      ? undefined
      : (selectedArtifacts.keepsakeEquipResults.at(blockedKeepsakeEquipResultAt) ??
        blockedArtifacts.keepsakeEquipResults.at(blockedKeepsakeEquipResultAt));
  const keepsakeEquipResults =
    blockedKeepsakeEquipResultAt === undefined || blockedKeepsakeEquipResultCapability === undefined
      ? retainedArtifacts.keepsakeEquipResults
      : createKeepsakeEquipResultCandidateArtifacts(
          new Map([
            ...retainedArtifacts.keepsakeEquipResults.entries(),
            [
              semanticAddressKey(blockedKeepsakeEquipResultAt),
              blockedKeepsakeEquipResultCapability,
            ] as const,
          ]),
        );
  const blockedAcquisitionCapability =
    blockedAcquisitionAt === undefined
      ? undefined
      : (selectedArtifacts.acquisitionConversions.at(blockedAcquisitionAt) ??
        blockedArtifacts.acquisitionConversions.at(blockedAcquisitionAt));
  const blockedReplacementCapability =
    blockedDerivedAcquisitionAt === undefined
      ? undefined
      : (selectedArtifacts.acquisitionConversions.atReplacement(blockedDerivedAcquisitionAt) ??
        blockedArtifacts.acquisitionConversions.atReplacement(blockedDerivedAcquisitionAt));
  const acquisitionConversions =
    (blockedAcquisitionAt === undefined || blockedAcquisitionCapability === undefined) &&
    blockedReplacementCapability === undefined
      ? retainedArtifacts.acquisitionConversions
      : Object.freeze({
          at: (address: AcquisitionRoleAddress) =>
            blockedAcquisitionAt !== undefined &&
            blockedAcquisitionCapability !== undefined &&
            semanticAddressKey(address) === semanticAddressKey(blockedAcquisitionAt)
              ? blockedAcquisitionCapability
              : blockedReplacementCapability !== undefined &&
                  semanticAddressKey(address) ===
                    semanticAddressKey(blockedReplacementCapability.address)
                ? blockedReplacementCapability.capability
                : retainedArtifacts.acquisitionConversions.at(address),
          atReplacement: (address: AcquisitionEntryAddress) =>
            blockedDerivedAcquisitionAt !== undefined &&
            blockedReplacementCapability !== undefined &&
            semanticAddressKey(address) === semanticAddressKey(blockedDerivedAcquisitionAt)
              ? blockedReplacementCapability
              : retainedArtifacts.acquisitionConversions.atReplacement(address),
        });
  const blockedDerivedAcquisitionCapability =
    blockedDerivedAcquisitionAt === undefined
      ? undefined
      : (selectedArtifacts.derivedAcquisitionEntries.at(blockedDerivedAcquisitionAt) ??
        blockedArtifacts.derivedAcquisitionEntries.at(blockedDerivedAcquisitionAt));
  const derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts =
    blockedDerivedAcquisitionAt === undefined || blockedDerivedAcquisitionCapability === undefined
      ? retainedArtifacts.derivedAcquisitionEntries
      : Object.freeze({
          at: (address: AcquisitionEntryAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedDerivedAcquisitionAt)
              ? blockedDerivedAcquisitionCapability
              : retainedArtifacts.derivedAcquisitionEntries.at(address),
          entriesAt: (site: import('../../authored-project/addresses').AcquisitionSiteAddress) => {
            const retained = retainedArtifacts.derivedAcquisitionEntries.entriesAt(site);
            if (
              semanticAddressKey(site) !== semanticAddressKey(blockedDerivedAcquisitionAt.site) ||
              retained.some(
                (entry) =>
                  semanticAddressKey(entry.address) ===
                  semanticAddressKey(blockedDerivedAcquisitionAt),
              )
            ) {
              return retained;
            }
            return Object.freeze([
              ...retained,
              Object.freeze({
                address: blockedDerivedAcquisitionAt,
                capability: blockedDerivedAcquisitionCapability,
              }),
            ]);
          },
        });
  const rewardOwner = ancestors.rewardOwner;
  const rewardCapability =
    rewardOwner === undefined
      ? undefined
      : (selectedArtifacts.rewardProducers.at(rewardOwner) ??
        blockedArtifacts.rewardProducers.at(rewardOwner));
  const occurrenceOwner = ancestors.occurrenceOwner;
  const shipCapability =
    occurrenceOwner === undefined
      ? undefined
      : (selectedArtifacts.roomLifecycles.shipAt(occurrenceOwner) ??
        blockedArtifacts.roomLifecycles.shipAt(occurrenceOwner));
  const encounterCapability =
    occurrenceOwner === undefined
      ? undefined
      : (selectedArtifacts.encounters.roomAt(occurrenceOwner) ??
        blockedArtifacts.encounters.roomAt(occurrenceOwner));
  const blockedTarget = ancestors.target;
  const blockedTargetCapability =
    blockedTarget === undefined
      ? undefined
      : (selectedArtifacts.roomTargets.at(blockedTarget) ??
        blockedArtifacts.roomTargets.at(blockedTarget));
  const roomTargets =
    blockedTargetCapability === undefined
      ? retainedArtifacts.roomTargets
      : Object.freeze({
          at: (target: TargetAddress) => {
            if (
              blockedTarget !== undefined &&
              semanticAddressKey(target) === semanticAddressKey(blockedTarget)
            ) {
              return blockedTargetCapability;
            }
            const retainedTarget = retainedOrdinaryBatches.some((batch) =>
              batch.targets.some(
                (assessment) =>
                  semanticAddressKey(assessment.origin) === semanticAddressKey(target),
              ),
            );
            // Interaction replay may need every peer to reconstruct one
            // shared-store repair context, but only physical targets inside
            // the retained generation horizon are publishable capabilities.
            return rewardOwner !== undefined && retainedTarget
              ? (blockedArtifacts.roomTargets.at(target) ??
                  retainedArtifacts.roomTargets.at(target))
              : retainedArtifacts.roomTargets.at(target);
          },
        });
  const blockedDerivedProducerCapability =
    blockedDerivedAcquisitionAt === undefined || blockedDerivedAcquisitionCapability === undefined
      ? undefined
      : Object.freeze({
          acquisitionHorizon: 'ownEnteredLifecycle' as const,
          evaluateOffer: (
            owner: RewardProducerOwnerAddress,
            offer: import('../../reward-kernel').ResolvedRewardOffer,
          ) => {
            const fixedOffer = blockedDerivedAcquisitionCapability.fixedReward?.offer;
            const supported =
              semanticAddressKey(owner) === semanticAddressKey(blockedDerivedAcquisitionAt) &&
              (blockedDerivedAcquisitionCapability.rewardTypes?.includes(offer.rewardType) ??
                false) &&
              (fixedOffer === undefined || JSON.stringify(fixedOffer) === JSON.stringify(offer));
            return Object.freeze({ findings: Object.freeze([]), supported });
          },
        });
  const rewardProducers: RewardProducerCandidateArtifacts =
    rewardCapability === undefined && blockedDerivedProducerCapability === undefined
      ? retainedArtifacts.rewardProducers
      : Object.freeze({
          at: (owner: RewardProducerOwnerAddress) => {
            if (
              rewardOwner !== undefined &&
              rewardCapability !== undefined &&
              semanticAddressKey(owner) === semanticAddressKey(rewardOwner)
            )
              return rewardCapability;
            if (
              blockedDerivedAcquisitionAt !== undefined &&
              blockedDerivedProducerCapability !== undefined &&
              semanticAddressKey(owner) === semanticAddressKey(blockedDerivedAcquisitionAt)
            )
              return blockedDerivedProducerCapability;
            return retainedArtifacts.rewardProducers.at(owner);
          },
        });
  const roomLifecycles =
    shipCapability === undefined
      ? retainedArtifacts.roomLifecycles
      : Object.freeze({
          shipAt: (owner: OccurrenceAddress) =>
            occurrenceOwner !== undefined &&
            semanticAddressKey(owner) === semanticAddressKey(occurrenceOwner) &&
            shipCapability !== undefined
              ? shipCapability
              : retainedArtifacts.roomLifecycles.shipAt(owner),
        });
  const encounterBase: EncounterCandidateArtifacts =
    encounterCapability === undefined
      ? retainedArtifacts.encounters
      : Object.freeze({
          at: retainedArtifacts.encounters.at,
          statusAt: retainedArtifacts.encounters.statusAt,
          gorgonAt: retainedArtifacts.encounters.gorgonAt,
          nemesisAt: retainedArtifacts.encounters.nemesisAt,
          figLeafAt: retainedArtifacts.encounters.figLeafAt,
          roomAt: (owner: OccurrenceAddress) =>
            occurrenceOwner !== undefined &&
            semanticAddressKey(owner) === semanticAddressKey(occurrenceOwner)
              ? encounterCapability
              : retainedArtifacts.encounters.roomAt(owner),
        });
  const blockedNemesisCapability =
    blockedNemesisAt === undefined
      ? undefined
      : (selectedArtifacts.encounters.nemesisAt(blockedNemesisAt) ??
        blockedArtifacts.encounters.nemesisAt(blockedNemesisAt));
  const encounters: EncounterCandidateArtifacts =
    blockedNemesisAt === undefined || blockedNemesisCapability === undefined
      ? encounterBase
      : Object.freeze({
          ...encounterBase,
          nemesisAt: (address: NemesisRandomEventAddress) =>
            semanticAddressKey(address) === semanticAddressKey(blockedNemesisAt)
              ? blockedNemesisCapability
              : retainedArtifacts.encounters.nemesisAt(address),
        });
  const artifacts = createBiomeCandidateArtifacts(
    retainedArtifacts.origin,
    roomTargets,
    rewardProducers,
    roomLifecycles,
    encounters,
    traitOffers,
    levelResolutions,
    judgmentArcana,
    keepsakeSelections,
    keepsakeEquipResults,
    acquisitionConversions,
    derivedAcquisitionEntries,
    steadyGrowth,
    undefined,
    undefined,
    undefined,
    retainedArtifacts.fountainRarity,
    figurineArcana,
    transcendentEmbryo,
    retainedArtifacts.chaos,
    retainedArtifacts.zagreusContracts,
  );
  return Object.freeze({
    rewards:
      selectedTraitOffers.length === retainedRewards.selectedTraitOffers.length &&
      selectedLevelResolutions.length === retainedRewards.selectedLevelResolutions.length &&
      rewardFindings.length === retainedRewards.findings.length &&
      blockedChildSettlement === undefined &&
      settledCurrentSiteBranches === undefined
        ? retainedRewards
        : Object.freeze({
            ...retainedRewards,
            ...(settledCurrentSiteBranches === undefined
              ? blockedChildSettlement === undefined
                ? {}
                : { branches: blockedChildSettlement.branches }
              : { branches: settledCurrentSiteBranches }),
            validity: rewardFindings.length === 0 ? retainedRewards.validity : 'invalid',
            findings: rewardFindings,
            runStateSnapshots,
            selectedTraitOffers,
            selectedLevelResolutions,
          }),
    artifacts,
  });
}

export function retainBlockedGenerationValidation(
  retained: BiomeGenerationValidation,
  selected: ProgressiveBiomeSelectedProducts,
  authoredPrefix: MaterializedBiomePrefix,
  selectedFindingRegions: readonly FindingRegionEntry[],
  blockedRegionKey: string,
  unsupported: LocatedFinding,
): BiomeGenerationValidation {
  const findings = Object.freeze(
    selectedFindingRegions
      .filter(
        (entry) => entry.atomicRegion === blockedRegionKey && entry.aggregate === 'generation',
      )
      .map((entry) => entry.finding),
  );
  const ordinaryBatches = retainedOrdinaryBatchHorizon(
    selected.roomGeneration.ordinary.ordinaryBatches,
    authoredPrefix,
    selected.history,
    unsupported,
  );
  const ordinary =
    ordinaryBatches === retained.ordinary.ordinaryBatches
      ? retained.ordinary
      : Object.freeze({ ...retained.ordinary, ordinaryBatches });
  if (findings.length === 0 && ordinary === retained.ordinary) return retained;
  const retainedKeys = new Set(retained.findings.map((finding) => findingIdentityKey(finding)));
  const merged = Object.freeze([
    ...retained.findings,
    ...findings.filter((finding) => {
      const key = findingIdentityKey(finding);
      if (retainedKeys.has(key)) return false;
      retainedKeys.add(key);
      return true;
    }),
  ]);
  return Object.freeze({
    ...retained,
    ordinary,
    ...(findings.length === 0 ? {} : { validity: 'invalid' as const }),
    findings: merged,
  });
}

function ordinaryBatchDecisionIndex(
  authoredPrefix: MaterializedBiomePrefix,
  origin: OrdinaryBatchGenerationAssessment['origin'],
): number {
  const direct = authoredPrefix.decisions.findIndex(
    (decision) => semanticAddressKey(decision.origin) === semanticAddressKey(origin),
  );
  if (direct >= 0) return direct;
  if (
    authoredPrefix.frontier?.kind === 'exitDecision' &&
    semanticAddressKey(authoredPrefix.frontier.origin) === semanticAddressKey(origin)
  ) {
    return authoredPrefix.decisions.length;
  }
  return Number.MAX_SAFE_INTEGER;
}

function targetGenerationCompletionSequence(
  selected: ProgressiveBiomeSelectedProducts['history'],
  target: TargetAddress,
): number | undefined {
  return selected.rooms
    .flatMap((room) => room.targetGenerations)
    .find(
      (generation) => semanticAddressKey(generation.targetOrigin) === semanticAddressKey(target),
    )?.after.sequence;
}

function batchTargetGenerationFinishedBeforeBlock(
  selected: ProgressiveBiomeSelectedProducts['history'],
  unsupported: LocatedFinding,
  batch: OrdinaryBatchGenerationAssessment,
): boolean {
  if (batch.targets.length === 0) return false;
  const chronologyUnavailableFallback =
    unsupported.historySequence === undefined &&
    unsupported.aggregate !== 'generation' &&
    (unsupported.targetIndex !== undefined || unsupported.additionalIndex !== undefined);
  let completedAt = -1;
  for (const target of batch.targets) {
    const sequence = targetGenerationCompletionSequence(selected, target.origin);
    if (sequence === undefined) return chronologyUnavailableFallback;
    completedAt = Math.max(completedAt, sequence);
  }
  if (unsupported.historySequence === undefined) {
    return chronologyUnavailableFallback;
  }
  return (
    unsupported.historySequence > completedAt ||
    (unsupported.historySequence === completedAt && unsupported.historyBoundary === 'after')
  );
}

/**
 * Selects the generation assessment horizon from one canonical batch product.
 * A blocker before target-generation completion retains the physical prefix;
 * a later child retains the complete batch that already existed at that point.
 */
function retainedOrdinaryBatchHorizon(
  selected: readonly OrdinaryBatchGenerationAssessment[],
  authoredPrefix: MaterializedBiomePrefix,
  history: ProgressiveBiomeSelectedProducts['history'],
  unsupported: LocatedFinding,
): readonly OrdinaryBatchGenerationAssessment[] {
  if (unsupported.decisionIndex < 0) return Object.freeze([]);
  const retained = selected.filter((batch) => {
    const index = ordinaryBatchDecisionIndex(authoredPrefix, batch.origin);
    if (index < unsupported.decisionIndex) return true;
    if (index > unsupported.decisionIndex) return false;
    return true;
  });
  const normalized = retained.map((batch) => {
    const index = ordinaryBatchDecisionIndex(authoredPrefix, batch.origin);
    if (index !== unsupported.decisionIndex) return batch;
    if (batchTargetGenerationFinishedBeforeBlock(history, unsupported, batch)) return batch;
    if (unsupported.targetIndex === undefined) {
      // A decision-owned generation finding (for example Fields outcome
      // support) is reached after the batch state exists but before its first
      // physical target. Preserve that decision assessment with an empty
      // completed target prefix.
      return Object.freeze({ ...batch, targets: Object.freeze([]) });
    }
    return Object.freeze({
      ...batch,
      targets: Object.freeze(batch.targets.slice(0, unsupported.targetIndex + 1)),
    });
  });
  return Object.freeze(normalized);
}
