import { semanticAddressKey, type SemanticAddress } from '../../../authored-project/addresses';
import type { BiomeRewardSimulation } from '../model';
import { createAcquisitionConversionCandidateArtifacts } from '../acquisition/artifacts';
import {
  createDerivedAcquisitionEntryCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../acquisition/artifacts';
import { createSteadyGrowthCandidateArtifacts } from '../../candidates/steady-growth';
import {
  createTranscendentEmbryoCandidateArtifacts,
  createFountainRarityCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';
import { createPurgingPoolCandidateArtifacts } from '../../commerce/purging-pool';
import { createHermesShrineCandidateArtifacts } from '../../commerce/hermes-shrine';
import { createStygianWellCandidateArtifacts } from '../../commerce/stygian-well';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
} from '../../candidates/trait-offer/capability';
import { publishRunStateThroughCoverage } from '../run-state';
import { createRoomLifecycleCandidateArtifacts } from '../lifecycle-artifacts';
import { selectedTraitOfferProducts } from './selected-trait-products';
import type { ChronologyAccumulation } from './chronology-accumulator';
import { type ChronologyWalkContext, type ChronologyWalkState } from './chronology-walk';
import {
  publishBiomeRewardEvaluationAssembly,
  type BiomeRewardEvaluationAssembly,
  type TraitChildSettlementCheckpoints,
} from './publication';

import { createRewardProducerCandidateArtifacts } from '../producer-frontiers';
import { publicRewardBranch } from '../branch-lifecycle';
import { mergeEquivalentRewardBranches } from '../branch-primitives';
import { createJudgmentArcanaCandidateArtifacts } from '../../arcana-fear';
import {
  createFigurineArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';

/** Publishes one biome's reward evaluation from its frozen walk and finished accumulation. */
export function publishChronology(
  context: ChronologyWalkContext,
  walk: ChronologyWalkState,
  accumulation: ChronologyAccumulation,
): BiomeRewardEvaluationAssembly {
  const { catalog, snapshot } = context;
  const immutableFindingRegions = accumulation.findingRegions;
  const immutableFindings = Object.freeze(immutableFindingRegions.map((entry) => entry.finding));
  const traitProducts = selectedTraitOfferProducts(
    walk.branches,
    immutableFindingRegions.flatMap((entry) =>
      entry.levelResolutionEvaluations === undefined ? [] : entry.levelResolutionEvaluations,
    ),
    catalog,
  );
  const traitCandidateContexts = new Map(traitProducts.candidateContexts);
  for (const [key, contexts] of accumulation.reachedTraitOfferCandidateContexts) {
    if (!traitCandidateContexts.has(key))
      traitCandidateContexts.set(key, Object.freeze([...contexts]));
  }
  for (const [childKey, checkpoint] of accumulation.traitChildSettlements) {
    if (checkpoint.candidateContexts.length === 0) continue;
    const key =
      checkpoint.address.kind === 'traitAcquisitionTarget' ||
      checkpoint.address.kind === 'allTogetherSet'
        ? semanticAddressKey(checkpoint.address.trait)
        : childKey;
    traitCandidateContexts.set(
      key,
      Object.freeze([...(traitCandidateContexts.get(key) ?? []), ...checkpoint.candidateContexts]),
    );
  }
  const levelCandidateContexts = new Map(traitProducts.levelCandidateContexts);
  const discoveredRunStateSnapshots = Object.freeze(
    [...accumulation.runStateSnapshots].sort((left, right) => {
      const leftRoom = left.owner.kind === 'roomRunStateCheckpoint';
      const rightRoom = right.owner.kind === 'roomRunStateCheckpoint';
      return leftRoom === rightRoom ? 0 : leftRoom ? 1 : -1;
    }),
  );
  const runStatePublication = publishRunStateThroughCoverage(
    discoveredRunStateSnapshots,
    discoveredRunStateSnapshots,
  );
  const traitChildSettlementProducts = new Map(
    [...accumulation.traitChildSettlements].map(([key, checkpoint]) =>
      Object.freeze([
        key,
        Object.freeze({
          branches: Object.freeze(
            mergeEquivalentRewardBranches(checkpoint.branches).map(publicRewardBranch),
          ),
          runStateSnapshots: Object.freeze([...checkpoint.runStateSnapshots.values()]),
        }),
      ] as const),
    ),
  );
  const traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints = Object.freeze({
    at: (address: SemanticAddress) => traitChildSettlementProducts.get(semanticAddressKey(address)),
  });
  const publishedHermesShrineAssessments = Object.freeze(
    [...walk.hermesShrineAssessments.values()].map(({ origin, assessments }) => {
      const travelDealRefills = walk.hermesShrineTravelDealRefills.get(semanticAddressKey(origin));
      return Object.freeze({
        origin,
        assessments: Object.freeze(
          assessments.map((assessment, index) =>
            travelDealRefills?.[index] === undefined
              ? assessment
              : Object.freeze({ ...assessment, travelDealRefill: travelDealRefills[index] }),
          ),
        ),
      });
    }),
  );
  const simulation: BiomeRewardSimulation = Object.freeze({
    ...(accumulation.generatedPickupPlacements.length === 0
      ? {}
      : { generatedPickupPlacements: accumulation.generatedPickupPlacements }),
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && walk.branches.length > 0 ? 'valid' : 'invalid',
    ...(accumulation.echoKeepsakeReplayOutcome === undefined
      ? {}
      : { volatileEchoKeepsakeReplay: accumulation.echoKeepsakeReplayOutcome }),
    timelineFacts: accumulation.timelineFacts,
    wellRefillRealizations: Object.freeze([...walk.wellRefillRealizations.values()]),
    bossArcanaOutcomes: accumulation.bossArcanaOutcomes,
    storeSupport: accumulation.storeSupport,
    targetHistory: accumulation.targetHistory,
    branches: Object.freeze(walk.branches.map(publicRewardBranch)),
    findings: immutableFindings,
    runStateSnapshots: runStatePublication.snapshots,
    runStateAvailability: runStatePublication.availability,
    hubDepartures: accumulation.hubDepartures,
    purgingPoolAssessments: Object.freeze([...walk.purgingPoolAssessments.values()]),
    hermesShrineAssessments: publishedHermesShrineAssessments,
    stygianWellAssessments: Object.freeze([...walk.stygianWellAssessments.values()]),
    hermesShrineDeliveries: Object.freeze([
      ...new Map(
        walk.branches
          .flatMap((branch) => Object.values(branch.state.pendingHermesShrineDeliveries))
          .map(
            (delivery) =>
              [
                delivery.sourceKey,
                Object.freeze({
                  sourceKey: delivery.sourceKey,
                  sourceOrigin: delivery.sourceOrigin,
                  rewardType: delivery.rewardType,
                  deliveryKind:
                    delivery.dueAt === undefined ? ('pending' as const) : ('countdown' as const),
                  ...(delivery.dueAt === undefined ? {} : { hostOrigin: delivery.dueAt }),
                  ...(delivery.dueSequence === undefined
                    ? {}
                    : { hostSequence: delivery.dueSequence }),
                  remainingUses: delivery.remainingUses,
                }),
              ] as const,
          ),
      ).values(),
    ]),
    selectedTraitOffers: traitProducts.selectedTraitOffers,
    selectedLevelResolutions: traitProducts.selectedLevelResolutions,
    figLeafPhaseCandidates: accumulation.figLeafPhaseCandidates,
    gorgonPhaseCandidates: accumulation.gorgonPhaseCandidates,
    nemesisRandomEventCandidates: accumulation.nemesisRandomEventCandidates,
    steadyGrowthOutcomes: Object.freeze(
      [...accumulation.steadyGrowthCandidateContexts.entries()].flatMap(([key, thresholds]) => {
        const address = accumulation.steadyGrowthOutcomeAddresses.get(key);
        const first = thresholds[0];
        if (address === undefined || first === undefined) return [];
        return [
          Object.freeze({
            address,
            sourceTraitKey: first.traitKey,
            phaseKey: address.phaseKey,
            requiredIntervals: Object.freeze(
              thresholds.map((threshold) => threshold.requiredInterval),
            ),
            progressBefore: Object.freeze(
              thresholds.map(
                (threshold) =>
                  threshold.before.equippedTraits[threshold.traitKey]?.steadyGrowthProgress ?? 0,
              ),
            ),
          }),
        ];
      }),
    ),
    transcendentEmbryoOutcomes: Object.freeze(
      [...accumulation.transcendentEmbryoCandidateContexts.entries()].flatMap(
        ([key, thresholds]) => {
          const address = accumulation.transcendentEmbryoOutcomeAddresses.get(key);
          const first = thresholds[0];
          if (address === undefined || first === undefined) return [];
          return [
            Object.freeze({
              address,
              sourceBlessingKey: first.source.markedBlessingKey,
              phaseKey: address.phaseKey,
              transformationRarities: Object.freeze(
                thresholds.map((threshold) => threshold.source.rarity),
              ),
              progressBefore: Object.freeze(
                thresholds.map((threshold) => threshold.source.progress),
              ),
            }),
          ];
        },
      ),
    ),
    derivedAcquisitionEntries: Object.freeze(
      [...accumulation.derivedAcquisitionEntryContexts.values()].flatMap((frontiers) => {
        const first = frontiers[0];
        const capability = attestDerivedAcquisitionEntryCandidateCapability(frontiers);
        return first === undefined || capability === undefined
          ? []
          : [Object.freeze({ address: first.address, ...capability })];
      }),
    ),
  });
  return publishBiomeRewardEvaluationAssembly({
    simulation,
    producerArtifacts: createRewardProducerCandidateArtifacts(accumulation.producerFrontiers),
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(
      walk.shipLifecycleContexts,
      accumulation.timedEffects,
    ),
    traitOfferArtifacts: createTraitOfferCandidateArtifacts(catalog, traitCandidateContexts),
    levelResolutionArtifacts: createLevelResolutionCandidateArtifacts(
      catalog,
      levelCandidateContexts,
    ),
    judgmentArcanaArtifacts: createJudgmentArcanaCandidateArtifacts(
      accumulation.judgmentArcanaContexts,
    ),
    figurineArcanaArtifacts: createFigurineArcanaCandidateArtifacts(
      accumulation.figurineArcanaContexts,
    ),
    keepsakeSelectionArtifacts: createKeepsakeSelectionCandidateArtifacts(
      accumulation.keepsakeSelectionContexts,
    ),
    keepsakeEquipResultArtifacts: createKeepsakeEquipResultCandidateArtifacts(
      accumulation.keepsakeEquipResultContexts,
    ),
    acquisitionConversionArtifacts: createAcquisitionConversionCandidateArtifacts(
      catalog,
      accumulation.acquisitionConversionContexts,
      accumulation.fixedAcquisitionRealizations,
    ),
    derivedAcquisitionEntryArtifacts: createDerivedAcquisitionEntryCandidateArtifacts(
      accumulation.derivedAcquisitionEntryContexts,
    ),
    steadyGrowthArtifacts: createSteadyGrowthCandidateArtifacts(
      catalog,
      accumulation.steadyGrowthCandidateContexts,
    ),
    transcendentEmbryoArtifacts: createTranscendentEmbryoCandidateArtifacts(
      catalog,
      accumulation.transcendentEmbryoCandidateContexts,
    ),
    fountainRarityArtifacts: createFountainRarityCandidateArtifacts(
      accumulation.fountainRarityCandidateContexts,
    ),
    purgingPoolArtifacts: createPurgingPoolCandidateArtifacts(
      new Map(
        [...walk.purgingPoolAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    hermesShrineArtifacts: createHermesShrineCandidateArtifacts(
      new Map(
        publishedHermesShrineAssessments.map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    stygianWellArtifacts: createStygianWellCandidateArtifacts(
      new Map(
        [...walk.stygianWellAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    traitChildSettlementCheckpoints,
    findingRegions: Object.freeze(immutableFindingRegions),
  });
}
