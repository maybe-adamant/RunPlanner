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
import type { EncounterPhaseAddress } from '../../authored-project/addresses';
import type { TraitRarity } from '../../catalog-schema';

export interface FigLeafPhaseCandidateSupport {
  readonly origin: EncounterPhaseAddress;
  readonly supported: boolean;
  readonly selected: boolean;
  readonly remainingUses: number;
  readonly activatedThisBiome: boolean;
}

/** Exact reached-phase authoring capability captured by the reward fold. */
export interface GorgonPhaseCandidateSupport {
  readonly origin: EncounterPhaseAddress;
  readonly supported: boolean;
  /** Encounter-start snapshot; absent when no pending appearance reached this phase. */
  readonly rarity?: TraitRarity;
}

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
  readonly figLeafPhaseCandidates: readonly FigLeafPhaseCandidateSupport[];
  readonly gorgonPhaseCandidates: readonly GorgonPhaseCandidateSupport[];
  readonly derivedAcquisitionEntries: readonly {
    readonly address: import('../../authored-project/addresses').AcquisitionEntryAddress;
    readonly kind: import('./processing').DerivedAcquisitionEntryFrontier['kind'];
    readonly sourceOfferKey?: string;
    readonly slotIndex?: number;
    readonly defaultValue?: import('../../authored-project/model').AuthoredRewardState;
    readonly rewardTypes?: readonly string[];
    readonly eligibleSourceOfferKeys?: readonly string[];
  }[];
}

export type RewardSimulation = BiomeRewardSimulation;
