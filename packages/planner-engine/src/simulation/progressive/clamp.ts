import {
  createBiomeCandidateArtifacts,
  type BiomeCandidateArtifacts,
} from '../candidate-artifacts';
import type { MaterializedBiomePrefix } from '../materialization';
import type { FindingRegionEntry } from '../finding-regions';
import type { BiomeRewardSimulation } from '../rewards';
import type { TraitChildSettlementCheckpoints } from '../rewards/biome';
import {
  blockedAncestorChain,
  findingsAtRegion,
  mergedFindings,
  rewardOwnerAddress,
  type LocatedFinding,
  type ProgressiveBiomeSelectedProducts,
} from './finding-location';
import { clampPrefix, retainedInteractionPrefix } from './prefix';
import {
  retainBlockedGenerationValidation,
  retainBlockedRegionProducts,
} from './selected-products';
import type { ProgressiveBiomeEvaluationAssembly, ProgressiveBiomeEvaluation } from './products';

export interface ProgressiveClampProducts {
  readonly history: ProgressiveBiomeEvaluation['history'];
  readonly roomGeneration: ProgressiveBiomeEvaluation['roomGeneration'];
  readonly rewards: BiomeRewardSimulation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
}

export interface ProgressivePrefixEvaluation {
  readonly evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

export type EvaluateProgressivePrefix = (
  prefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
) => ProgressivePrefixEvaluation;

export function clampSelectedProducts(
  authoredPrefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  evaluatePrefix: EvaluateProgressivePrefix,
  selectedProducts: ProgressiveBiomeSelectedProducts,
  unsupported: LocatedFinding,
): ProgressiveBiomeEvaluationAssembly | null {
  const retainedFindings = findingsAtRegion(
    authoredPrefix,
    selectedProducts.findingRegions,
    unsupported.regionKey,
  );
  const clamped = clampPrefix(authoredPrefix, unsupported);
  if (clamped.entryRoom === undefined) return null;
  const executionPrefix = clamped as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const evaluated = evaluatePrefix(executionPrefix);
  const interactionPrefix = retainedInteractionPrefix(
    authoredPrefix,
    unsupported,
  ) as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const interactionProducts = evaluatePrefix(interactionPrefix);
  const ancestors = blockedAncestorChain(authoredPrefix, unsupported);
  const retainedRoomGeneration = retainBlockedGenerationValidation(
    evaluated.evaluation.roomGeneration,
    selectedProducts,
    authoredPrefix,
    selectedProducts.findingRegions,
    unsupported.regionKey,
    unsupported,
  );
  const blockedProducts = retainBlockedRegionProducts(
    evaluated.evaluation.rewards,
    evaluated.candidateArtifacts,
    interactionProducts.candidateArtifacts,
    selectedProducts.rewards,
    selectedProducts.candidateArtifacts,
    selectedProducts.traitChildSettlementCheckpoints,
    ancestors,
    unsupported.finding.origin,
    unsupported.regionKey,
    selectedProducts.findingRegions,
    authoredPrefix.frontier?.kind === 'exitDecision' &&
      authoredPrefix.frontier.parent.origin.kind === 'occurrence'
      ? authoredPrefix.frontier.parent.origin
      : undefined,
    retainedRoomGeneration.ordinary.ordinaryBatches,
  );
  const retainedRewards = blockedProducts.rewards;
  const retainedInteractions = blockedProducts.artifacts;
  return Object.freeze({
    evaluation: Object.freeze({
      ...evaluated.evaluation,
      materializedPrefix: authoredPrefix,
      roomGeneration: retainedRoomGeneration,
      rewards: retainedRewards,
      assessmentPrefix:
        rewardOwnerAddress(unsupported.finding.origin) === undefined
          ? executionPrefix
          : interactionPrefix,
      findings: mergedFindings(evaluated.evaluation, retainedFindings),
      blockedAt: unsupported.finding.origin,
    }),
    candidateArtifacts: createBiomeCandidateArtifacts(
      evaluated.candidateArtifacts.origin,
      retainedInteractions.roomTargets,
      retainedInteractions.rewardProducers,
      retainedInteractions.roomLifecycles,
      retainedInteractions.encounters,
      retainedInteractions.traitOffers,
      retainedInteractions.levelResolutions,
      retainedInteractions.judgmentArcana,
      retainedInteractions.keepsakeSelections,
      retainedInteractions.keepsakeEquipResults,
      retainedInteractions.acquisitionConversions,
      retainedInteractions.derivedAcquisitionEntries,
      retainedInteractions.steadyGrowth,
      selectedProducts.candidateArtifacts.purgingPools,
      selectedProducts.candidateArtifacts.hermesShrines,
      selectedProducts.candidateArtifacts.stygianWells,
      selectedProducts.candidateArtifacts.fountainRarity,
      selectedProducts.candidateArtifacts.figurineArcana,
      selectedProducts.candidateArtifacts.transcendentEmbryo,
      selectedProducts.candidateArtifacts.chaos,
      selectedProducts.candidateArtifacts.zagreusContracts,
    ),
  });
}
