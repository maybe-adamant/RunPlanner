import type { SemanticAddress } from '../../authored-project/addresses';
import type {
  AcquisitionConversionCandidateArtifacts,
  DerivedAcquisitionEntryCandidateArtifacts,
  HermesShrineCandidateArtifacts,
  JudgmentArcanaCandidateArtifacts,
  KeepsakeEquipResultCandidateArtifacts,
  KeepsakeSelectionCandidateArtifacts,
  PurgingPoolCandidateArtifacts,
  SteadyGrowthCandidateArtifacts,
  StygianWellCandidateArtifacts,
} from '../candidate-artifacts';
import type {
  LevelResolutionCandidateArtifacts,
  TraitOfferCandidateArtifacts,
} from '../candidates/trait-offer-capability';
import type { FindingRegionEntry } from '../finding-regions';
import type { BiomeRewardSimulation, RewardBranch } from './model';
import type { RoomLifecycleCandidateArtifacts } from './lifecycle-artifacts';
import type { RewardProducerCandidateArtifacts } from './producer-frontiers';
import type { RunStateSnapshot } from './run-state';

export interface TraitChildSettlementCheckpoint {
  readonly branches: readonly RewardBranch[];
  readonly runStateSnapshots: readonly RunStateSnapshot[];
}

export interface TraitChildSettlementCheckpoints {
  readonly at: (address: SemanticAddress) => TraitChildSettlementCheckpoint | undefined;
}

export interface BiomeRewardEvaluationAssembly {
  readonly simulation: BiomeRewardSimulation;
  readonly producerArtifacts: RewardProducerCandidateArtifacts;
  readonly lifecycleArtifacts: RoomLifecycleCandidateArtifacts;
  readonly traitOfferArtifacts: TraitOfferCandidateArtifacts;
  readonly levelResolutionArtifacts: LevelResolutionCandidateArtifacts;
  readonly judgmentArcanaArtifacts: JudgmentArcanaCandidateArtifacts;
  readonly keepsakeSelectionArtifacts: KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResultArtifacts: KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversionArtifacts: AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntryArtifacts: DerivedAcquisitionEntryCandidateArtifacts;
  readonly steadyGrowthArtifacts: SteadyGrowthCandidateArtifacts;
  readonly purgingPoolArtifacts: PurgingPoolCandidateArtifacts;
  readonly hermesShrineArtifacts: HermesShrineCandidateArtifacts;
  readonly stygianWellArtifacts: StygianWellCandidateArtifacts;
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
  readonly findingRegions: readonly FindingRegionEntry[];
}

/** Freezes the complete product accumulated by the chronological evaluator. */
export function publishBiomeRewardEvaluationAssembly(
  input: BiomeRewardEvaluationAssembly,
): BiomeRewardEvaluationAssembly {
  return Object.freeze({ ...input });
}
