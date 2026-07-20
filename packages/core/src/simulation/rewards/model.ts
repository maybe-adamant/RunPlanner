import type { RewardBagState, RewardHistoryState } from '../../rewardKernel/model';
import type { BatchRewardStoreAddress, SemanticAddress } from '../../project/addresses';
import type { ConcreteAcquisitionEvent, ResolvedRewardOffer } from '../../rewardKernel/model';
import type { SemanticFinding } from '../model';

interface FRewardEventBase {
  readonly rewardSequence: number;
  readonly historySequence: number;
  readonly origin: SemanticAddress;
}

export type FRewardEvent =
  | (FRewardEventBase & {
      readonly kind: 'rewardOffered';
      readonly offer: ResolvedRewardOffer;
      readonly storeKey?: string;
    })
  | (FRewardEventBase & {
      readonly kind: 'concreteAcquisition';
      readonly acquisition: ConcreteAcquisitionEvent;
    })
  | (FRewardEventBase & {
      readonly kind: 'shopInventorySupported';
      readonly profileKey: string;
      readonly optionKeys: readonly string[];
    })
  | (FRewardEventBase & {
      readonly kind: 'shopPurchasesSupported';
      readonly profileKey: string;
      readonly purchaseOrder: readonly string[];
    });

export interface FRewardStoreSupportEntry {
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

export interface FRewardBranch {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly FRewardEvent[];
  readonly processedThroughHistorySequence: number;
}

export interface FRewardSimulation {
  readonly biomeKey: 'F';
  readonly validity: 'invalid' | 'valid';
  readonly storeSupport: readonly FRewardStoreSupportEntry[];
  readonly branches: readonly FRewardBranch[];
  readonly findings: readonly SemanticFinding[];
}
