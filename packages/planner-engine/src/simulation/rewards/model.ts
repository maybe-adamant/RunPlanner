import type { RewardBagState, RewardHistoryState } from '../../reward-kernel/model';
import type {
  BatchRewardStoreAddress,
  SemanticAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type { ConcreteAcquisitionEvent, ResolvedRewardOffer } from '../../reward-kernel/model';
import type { SemanticFinding } from '../model';
import type {
  SelectedLevelResolutionAssessment,
  SelectedTraitOfferAssessment,
  TraitHistoryState,
} from '../traits';
import type { DecisionRunStateAvailability, DecisionRunStateSnapshot } from './run-state';

interface RewardEventBase {
  readonly rewardSequence: number;
  readonly historySequence: number;
  readonly origin: SemanticAddress;
}

export type RewardEvent =
  | (RewardEventBase & {
      readonly kind: 'rewardOffered';
      readonly offer: ResolvedRewardOffer;
      readonly storeKey?: string;
    })
  | (RewardEventBase & {
      readonly kind: 'concreteAcquisition';
      readonly acquisition: ConcreteAcquisitionEvent;
    })
  | (RewardEventBase & {
      readonly kind: 'shopInventorySupported';
      readonly profileKey: string;
      readonly optionKeys: readonly string[];
    })
  | (RewardEventBase & {
      readonly kind: 'shopPurchasesSupported';
      readonly profileKey: string;
      readonly purchaseOrder: readonly string[];
    });

export interface RewardStoreCandidateSupport {
  readonly origin: BatchRewardStoreAddress;
  readonly historySequence: number;
  readonly enteredStoreCount: number;
  readonly enteredMetaStoreCount: number;
  readonly currentMetaRatio: number | null;
  readonly metaSelectionValue: number;
  readonly supportStoreKeys: readonly string[];
}

export interface RewardStoreSupportEntry extends RewardStoreCandidateSupport {
  readonly authoredStoreKey: string;
  readonly selectedPossible: boolean;
}

export interface RewardBranch {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly RewardEvent[];
  readonly processedThroughHistorySequence: number;
  readonly traitHistory?: TraitHistoryState;
}

export interface TargetRewardHistoryCheckpoint {
  readonly origin: TargetAddress;
  readonly historySequence: number;
  readonly histories: readonly RewardHistoryState[];
}

interface RewardSimulationBase {
  readonly biomeKey: string;
  readonly validity: 'invalid' | 'valid';
  readonly branches: readonly RewardBranch[];
  readonly findings: readonly SemanticFinding[];
}

export interface BiomeRewardSimulation extends RewardSimulationBase {
  readonly storeSupport: readonly RewardStoreSupportEntry[];
  readonly targetHistory: readonly TargetRewardHistoryCheckpoint[];
  readonly rewardLookups: Readonly<Record<string, readonly string[]>>;
  readonly runStateSnapshots: readonly DecisionRunStateSnapshot[];
  readonly runStateAvailability: readonly DecisionRunStateAvailability[];
  readonly selectedTraitOffers: readonly SelectedTraitOfferAssessment[];
  readonly selectedLevelResolutions: readonly SelectedLevelResolutionAssessment[];
}

export type RewardSimulation = BiomeRewardSimulation;
