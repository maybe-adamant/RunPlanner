import type { SemanticAddress } from '../../../authored-project/addresses';
import { type AcquisitionConversionCandidateArtifacts } from '../acquisition-artifacts';
import { type DerivedAcquisitionEntryCandidateArtifacts } from '../acquisition-artifacts';
import { type HermesShrineCandidateArtifacts } from '../../hermes-shrine';
import { type JudgmentArcanaCandidateArtifacts } from '../../arcana-fear';
import {
  type FigurineArcanaCandidateArtifacts,
  type KeepsakeEquipResultCandidateArtifacts,
  type KeepsakeSelectionCandidateArtifacts,
  type TranscendentEmbryoCandidateArtifacts,
  type FountainRarityCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';
import { type PurgingPoolCandidateArtifacts } from '../../purging-pool';
import { type SteadyGrowthCandidateArtifacts } from '../../trait-history';
import { type StygianWellCandidateArtifacts } from '../../stygian-well';
import type {
  LevelResolutionCandidateArtifacts,
  TraitOfferCandidateArtifacts,
} from '../../candidates/trait-offer-capability';
import type { FindingRegionEntry } from '../../finding-regions';
import type { BiomeRewardSimulation, RewardBranch } from '../model';
import type { RoomLifecycleCandidateArtifacts } from '../lifecycle-artifacts';
import type { RewardProducerCandidateArtifacts } from '../producer-frontiers';
import type { RunStateSnapshot } from '../run-state';

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
  readonly figurineArcanaArtifacts: FigurineArcanaCandidateArtifacts;
  readonly keepsakeSelectionArtifacts: KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResultArtifacts: KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversionArtifacts: AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntryArtifacts: DerivedAcquisitionEntryCandidateArtifacts;
  readonly steadyGrowthArtifacts: SteadyGrowthCandidateArtifacts;
  readonly transcendentEmbryoArtifacts: TranscendentEmbryoCandidateArtifacts;
  readonly purgingPoolArtifacts: PurgingPoolCandidateArtifacts;
  readonly hermesShrineArtifacts: HermesShrineCandidateArtifacts;
  readonly stygianWellArtifacts: StygianWellCandidateArtifacts;
  readonly fountainRarityArtifacts: FountainRarityCandidateArtifacts;
  readonly traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints;
  readonly findingRegions: readonly FindingRegionEntry[];
}

/** Freezes the complete product accumulated by the chronological evaluator. */
export function publishBiomeRewardEvaluationAssembly(
  input: BiomeRewardEvaluationAssembly,
): BiomeRewardEvaluationAssembly {
  return Object.freeze({ ...input });
}
