import type { RewardBagState, RewardHistoryState } from '../../reward-kernel/model';
import type {
  AcquisitionEntryAddress,
  AcquisitionSiteAddress,
  BatchRewardStoreAddress,
  SemanticAddress,
  SteadyGrowthOutcomeAddress,
  TranscendentEmbryoOutcomeAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type { ConcreteAcquisitionEvent, ResolvedRewardOffer } from '../../reward-kernel/model';
import type { SemanticFinding } from '../model';
import type {
  SelectedLevelResolutionAssessment,
  SelectedTraitOfferAssessment,
  TraitHistoryState,
} from '../traits';
import type { RunStateAvailability, RunStateSnapshot } from './run-state';
import type { ArcanaFearState } from '../arcana-fear';
import type { KeepsakeState } from '../keepsakes';
import type { EncounterPhaseAddress } from '../../authored-project/addresses';
import type { TraitRarity } from '../../catalog-schema';
import type { NemesisRandomEventAddress } from '../../authored-project/addresses';

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

/** Exact pre-interaction domain for the one selected Nemesis random event. */
export interface NemesisRandomEventCandidateSupport {
  readonly origin: NemesisRandomEventAddress;
  readonly familyKeys: readonly (
    'freeItem' | 'goldTrade' | 'damageTrade' | 'traitTrade' | 'damageContest'
  )[];
  /** Declaration-owned closed controls; UI does not infer these policy values. */
  readonly goldTradeResponses: readonly ('accept' | 'decline')[];
  readonly damageTradeResponses: readonly ('accept' | 'decline')[];
  readonly traitTradeResponses: readonly ('accept' | 'decline')[];
  readonly damageContestResults: readonly ('success' | 'failure')[];
  readonly traitTradeRewardType: string;
  readonly damageContestFailureRewardType: string;
  /**
   * One exact assessment per reachable reward-history branch. Domains must not
   * be flattened: a result and a trait target are correlated within a branch.
   */
  readonly branches: readonly NemesisRandomEventBranchAssessment[];
}

export interface NemesisRandomEventBranchAssessment {
  readonly freeItemRewardTypes: readonly string[];
  readonly goldTradeRewardTypes: readonly string[];
  readonly damageTradeRewardTypes: readonly string[];
  readonly damageContestSuccessRewardTypes: readonly string[];
  /** Common eligible traits take precedence; otherwise this is the eligible God-trait domain. */
  readonly traitTradeTraitKeys: readonly string[];
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
      /** Source was destroyed and a separate RunProgress replacement was generated. */
      readonly kind: 'artificerConversion';
      readonly acquisition: ConcreteAcquisitionEvent;
      readonly replacement: ResolvedRewardOffer;
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
      /** Automatic RoomReward substitution evidence; concrete Onion follows this event. */
      readonly kind: 'rewardForfeited';
      readonly rewardType: 'Boon' | 'HermesUpgrade';
      readonly replacementRewardType: 'RoomRewardConsolationPrize';
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
  /** Ordered global priorities that intentionally survive biome boundaries. */
  readonly rewardPriorities: readonly string[];
  readonly hexProgress: import('../hex-progress').HexProgressState;
  readonly history: RewardHistoryState;
  readonly events: readonly RewardEvent[];
  readonly processedThroughHistorySequence: number;
  readonly traitHistory?: TraitHistoryState;
  readonly arcanaFear: ArcanaFearState;
  readonly keepsakes: KeepsakeState;
  /** Engine-derived delayed Shrine state carried between biome evaluations. */
  readonly pendingHermesShrineDeliveries?: Readonly<
    Record<string, import('./branch-primitives').PendingHermesShrineDelivery>
  >;
  readonly stygianWell?: import('../stygian-well').StygianWellRunState;
}

export interface TargetRewardHistoryCheckpoint {
  readonly origin: TargetAddress;
  readonly historySequence: number;
  readonly histories: readonly RewardHistoryState[];
  /** Agreement-owned branch fact for later room generation requirements. */
  readonly pendingSpellDrops: readonly boolean[];
  /** Branch-owned closure truth must agree before a generated target can use it. */
  readonly allSpellInvested: readonly boolean[];
}

interface RewardSimulationBase {
  readonly biomeKey: string;
  readonly validity: 'invalid' | 'valid';
  readonly branches: readonly RewardBranch[];
  readonly findings: readonly SemanticFinding[];
}

/** One evaluated source-local runtime substitute for a selected result/action. */
export interface ResolvedRuntimeOfferFallback {
  readonly address: SemanticAddress;
  readonly preferredKey: string;
  readonly fallbackKey: string;
}

export interface BiomeRewardSimulation extends RewardSimulationBase {
  readonly storeSupport: readonly RewardStoreSupportEntry[];
  readonly targetHistory: readonly TargetRewardHistoryCheckpoint[];
  readonly rewardLookups: Readonly<Record<string, readonly string[]>>;
  readonly runStateSnapshots: readonly RunStateSnapshot[];
  readonly runStateAvailability: readonly RunStateAvailability[];
  /** Exact room-entry Pool generation assessments, before any sale action. */
  readonly purgingPoolAssessments: readonly {
    readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
    readonly assessments: readonly import('../purging-pool').PurgingPoolAssessment[];
  }[];
  /** Exact room-entry Shrine placement and inventory assessments. */
  readonly hermesShrineAssessments: readonly {
    readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
    readonly assessments: readonly import('../hermes-shrine').HermesShrineCandidateContext[];
  }[];
  /** Exact room-entry Well placement and inventory assessments. */
  readonly stygianWellAssessments: readonly {
    readonly origin: import('../../authored-project/addresses').OccurrenceAddress;
    readonly assessments: readonly import('../stygian-well').StygianWellCandidateContext[];
  }[];
  /** Derived source-to-host delivery state; no pending object is persisted. */
  readonly hermesShrineDeliveries: readonly import('../hermes-shrine').DerivedHermesShrineDelivery[];
  readonly selectedTraitOffers: readonly SelectedTraitOfferAssessment[];
  readonly selectedLevelResolutions: readonly SelectedLevelResolutionAssessment[];
  /** One resolved runtime substitute per reached selected result/action. */
  readonly runtimeOfferFallbacks: readonly ResolvedRuntimeOfferFallback[];
  readonly figLeafPhaseCandidates: readonly FigLeafPhaseCandidateSupport[];
  readonly gorgonPhaseCandidates: readonly GorgonPhaseCandidateSupport[];
  readonly nemesisRandomEventCandidates: readonly NemesisRandomEventCandidateSupport[];
  /** Exact reached automatic Steady Growth checkpoints for workspace timelines. */
  readonly steadyGrowthOutcomes: readonly {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly sourceTraitKey: string;
    readonly phaseKey: string;
    readonly requiredIntervals: readonly number[];
    readonly progressBefore: readonly number[];
  }[];
  /** Exact reached automatic Transcendent Embryo checkpoints. */
  readonly transcendentEmbryoOutcomes: readonly {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly sourceBlessingKey: string;
    readonly phaseKey: string;
    readonly transformationRarities: readonly import('../../catalog-schema').InRunTraitRarity[];
    readonly progressBefore: readonly number[];
  }[];
  readonly derivedAcquisitionEntries: readonly {
    readonly address: import('../../authored-project/addresses').AcquisitionEntryAddress;
    readonly kind: import('./acquisition-settlement').DerivedAcquisitionEntryFrontier['kind'];
    readonly sourceOfferKey?: string;
    readonly slotIndex?: number;
    readonly rewardTypes?: readonly string[];
    readonly fixedReward?: import('../../authored-project/model').AuthoredRewardState;
    readonly retainedSourceMismatch?: boolean;
    readonly eligibleSourceOfferKeys?: readonly string[];
  }[];
}

export type RewardSimulation = BiomeRewardSimulation;
