import type { RewardBagState, RewardHistoryState } from '../../reward-kernel/model';
import type {
  AcquisitionEntryAddress,
  AcquisitionSiteAddress,
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
import type { ArcanaFearState } from '../arcana-fear';
import type { KeepsakeState } from '../keepsakes';

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
      /** Present when the acquisition was applied by a canonical settlement site. */
      readonly settlement?: {
        readonly site: AcquisitionSiteAddress;
        readonly entry: AcquisitionEntryAddress;
      };
    })
  | (RewardEventBase & {
      /** Evidence of a Time Piece choice; intentionally no Gold acquisition exists. */
      readonly kind: 'conversionToGold';
      readonly acquisition: ConcreteAcquisitionEvent;
      readonly settlement?: {
        readonly site: AcquisitionSiteAddress;
        readonly entry: AcquisitionEntryAddress;
      };
    })
  | (RewardEventBase & {
      readonly kind: 'shopInventorySupported';
      readonly profileKey: string;
      readonly optionKeys: readonly string[];
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
  readonly arcanaFear: ArcanaFearState;
  readonly keepsakes: KeepsakeState;
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
