import type { RewardBagState, RewardHistoryState } from '../../rewardKernel/model';
import type {
  BatchRewardStoreAddress,
  SemanticAddress,
  TargetAddress,
} from '../../project/addresses';
import type { ConcreteAcquisitionEvent, ResolvedRewardOffer } from '../../rewardKernel/model';
import type { SemanticFinding } from '../model';

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

export interface RewardStoreSupportEntry {
  readonly origin: BatchRewardStoreAddress;
  readonly historySequence: number;
  readonly authoredStoreKey: string;
  readonly enteredStoreCount: number;
  readonly enteredMetaStoreCount: number;
  readonly currentMetaRatio: number | null;
  readonly metaSelectionValue: number;
  readonly supportStoreKeys: readonly string[];
  readonly selectedPossible: boolean;
}

export interface RewardBranch {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly RewardEvent[];
  readonly processedThroughHistorySequence: number;
}

export interface LinearTargetRewardHistoryCheckpoint {
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

export interface LinearRewardSimulation extends RewardSimulationBase {
  readonly storeSupport: readonly RewardStoreSupportEntry[];
  readonly targetHistory: readonly LinearTargetRewardHistoryCheckpoint[];
}

export interface HubRewardSimulation extends RewardSimulationBase {
  readonly rewardLookups: Readonly<Record<string, readonly string[]>>;
}

export type RewardSimulation = HubRewardSimulation | LinearRewardSimulation;

export type LinearRewardEvent = RewardEvent;
export type LinearRewardStoreSupportEntry = RewardStoreSupportEntry;
export type LinearRewardBranch = RewardBranch;
export type FRewardEvent = RewardEvent;
export type FRewardStoreSupportEntry = RewardStoreSupportEntry;
export type FRewardBranch = RewardBranch;
export type FRewardSimulation = LinearRewardSimulation;
