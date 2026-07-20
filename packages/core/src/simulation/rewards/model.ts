import type { RewardBagState, RewardHistoryState } from '../../rewardKernel/model';
import type { BatchRewardStoreAddress, SemanticAddress } from '../../project/addresses';
import type { ConcreteAcquisitionEvent, ResolvedRewardOffer } from '../../rewardKernel/model';
import type { SemanticFinding } from '../model';

interface LinearRewardEventBase {
  readonly rewardSequence: number;
  readonly historySequence: number;
  readonly origin: SemanticAddress;
}

export type LinearRewardEvent =
  | (LinearRewardEventBase & {
      readonly kind: 'rewardOffered';
      readonly offer: ResolvedRewardOffer;
      readonly storeKey?: string;
    })
  | (LinearRewardEventBase & {
      readonly kind: 'concreteAcquisition';
      readonly acquisition: ConcreteAcquisitionEvent;
    })
  | (LinearRewardEventBase & {
      readonly kind: 'shopInventorySupported';
      readonly profileKey: string;
      readonly optionKeys: readonly string[];
    })
  | (LinearRewardEventBase & {
      readonly kind: 'shopPurchasesSupported';
      readonly profileKey: string;
      readonly purchaseOrder: readonly string[];
    });

export interface LinearRewardStoreSupportEntry {
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

export interface LinearRewardBranch {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly LinearRewardEvent[];
  readonly processedThroughHistorySequence: number;
}

export interface LinearRewardSimulation {
  readonly biomeKey: string;
  readonly validity: 'invalid' | 'valid';
  readonly storeSupport: readonly LinearRewardStoreSupportEntry[];
  readonly branches: readonly LinearRewardBranch[];
  readonly findings: readonly SemanticFinding[];
}

export type FRewardEvent = LinearRewardEvent;
export type FRewardStoreSupportEntry = LinearRewardStoreSupportEntry;
export type FRewardBranch = LinearRewardBranch;
export type FRewardSimulation = LinearRewardSimulation;
