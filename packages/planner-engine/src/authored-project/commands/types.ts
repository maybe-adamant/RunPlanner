import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type {
  BatchRewardStoreAddress,
  BiomeAddress,
  BiomeFieldAddress,
  ContinuationAddress,
  HubSlotAddress,
  HubVisitAddress,
  IncomingRewardAddress,
  LocalChildAddress,
  LocalChildGroupAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  PickedAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  RouteAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from '../addresses';
import type { AuthoredFieldValue, OccurrenceId } from '../model';

export type ProjectCommand =
  | { readonly kind: 'RenameProject'; readonly name: string }
  | {
      readonly kind: 'ConfigureRoutePrefix';
      readonly route: RouteAddress;
      readonly configuredBiomeCount: number;
    }
  | {
      readonly kind: 'ReplaceBiomeField';
      readonly field: BiomeFieldAddress;
      readonly value: AuthoredFieldValue;
    }
  | {
      readonly kind: 'CreateStart';
      readonly biome: BiomeAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | {
      readonly kind: 'CreateHubTopology';
      readonly biome: BiomeAddress;
      readonly fixedOccurrenceIds: Readonly<Record<string, OccurrenceId>>;
    }
  | {
      readonly kind: 'OpenHubSlot';
      readonly slot: HubSlotAddress;
      readonly occurrenceId: OccurrenceId;
    }
  | { readonly kind: 'CloseHubSlot'; readonly slot: HubSlotAddress }
  | {
      readonly kind: 'AppendHubVisit';
      readonly visit: HubVisitAddress;
      readonly hubSlotKey: string;
    }
  | {
      readonly kind: 'ReplaceHubVisit';
      readonly visit: HubVisitAddress;
      readonly hubSlotKey: string;
    }
  | { readonly kind: 'RemoveHubVisitsFrom'; readonly visit: HubVisitAddress }
  | {
      readonly kind: 'ReplaceSideRoomGeneration';
      readonly sideRoom: LocalChildAddress;
      readonly generation: 'generated' | 'notGenerated';
    }
  | {
      readonly kind: 'ReplaceSideRoomEntryOrder';
      readonly group: LocalChildGroupAddress;
      readonly enteredSlotKeys: readonly string[];
    }
  | { readonly kind: 'CreateBatch'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'ReplaceBatchRewardStore';
      readonly rewardStore: BatchRewardStoreAddress;
      readonly storeKey: string;
    }
  | {
      readonly kind: 'ReplaceFieldsCageOutcome';
      readonly continuation: ContinuationAddress;
      readonly cageOutcome: 'min' | 'max';
    }
  | {
      readonly kind: 'ReplaceShipEncounterCount';
      readonly occurrence: OccurrenceAddress;
      readonly encounterCount: 2 | 3;
    }
  | {
      readonly kind: 'ReplaceRewardWheelOfferCount';
      readonly wheel: RewardWheelAddress;
      readonly offerCount: number;
    }
  | {
      readonly kind: 'ReplaceRewardWheelStore';
      readonly wheel: RewardWheelAddress;
      readonly storeKey: string;
    }
  | {
      readonly kind: 'ReplaceRewardWheelOffer';
      readonly offer: RewardWheelOfferAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'ReplaceRewardWheelPicked';
      readonly wheel: RewardWheelAddress;
      readonly pickedOfferIndex: number;
    }
  | {
      readonly kind: 'CreateTerminalTransition';
      readonly continuation: ContinuationAddress;
      readonly targetOccurrenceIds: readonly OccurrenceId[];
    }
  | {
      readonly kind: 'CreateTarget';
      readonly target: TargetAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | {
      readonly kind: 'SetPicked';
      readonly picked: PickedAddress;
      readonly exitIndex: number;
    }
  | {
      readonly kind: 'SetTerminalPicked';
      readonly picked: PickedAddress;
      readonly exitIndex: number;
    }
  | { readonly kind: 'ReconcileExitCapacity'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'ReconcileTerminalExitCapacity';
      readonly continuation: ContinuationAddress;
    }
  | { readonly kind: 'RemoveBatch'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'RemoveTerminalTransition';
      readonly continuation: ContinuationAddress;
    }
  | {
      readonly kind: 'ReplaceWithTerminalTransition';
      readonly continuation: ContinuationAddress;
      readonly targetOccurrenceIds: readonly OccurrenceId[];
    }
  | { readonly kind: 'ReplaceWithBatch'; readonly continuation: ContinuationAddress }
  | { readonly kind: 'ClearTopology'; readonly biome: BiomeAddress }
  | {
      readonly kind: 'ReplaceOccurrenceRoom';
      readonly occurrence: OccurrenceAddress;
      readonly gameName: string;
    }
  | {
      readonly kind: 'ReplaceIncomingReward';
      readonly reward: IncomingRewardAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'ReplaceLocalReward';
      readonly reward: LocalRewardAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'ReplaceShopOffer';
      readonly offer: ShopOfferAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'SetShopPurchase';
      readonly purchase: ShopPurchaseAddress;
      readonly purchased: boolean;
    };

export type ProjectMetadataCommand = Extract<
  ProjectCommand,
  { readonly kind: 'RenameProject' | 'ConfigureRoutePrefix' }
>;
export type HubOnlyProjectCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'CreateHubTopology'
      | 'OpenHubSlot'
      | 'CloseHubSlot'
      | 'AppendHubVisit'
      | 'ReplaceHubVisit'
      | 'RemoveHubVisitsFrom'
      | 'ReplaceSideRoomGeneration'
      | 'ReplaceSideRoomEntryOrder';
  }
>;
export type HubProjectCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | HubOnlyProjectCommand['kind']
      | 'ClearTopology'
      | 'ReplaceIncomingReward'
      | 'ReplaceLocalReward'
      | 'ReplaceShopOffer'
      | 'SetShopPurchase';
  }
>;
export type LinearTopologyProjectCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'CreateStart'
      | 'CreateBatch'
      | 'CreateTerminalTransition'
      | 'CreateTarget'
      | 'SetPicked'
      | 'SetTerminalPicked'
      | 'ReconcileExitCapacity'
      | 'ReconcileTerminalExitCapacity'
      | 'RemoveBatch'
      | 'RemoveTerminalTransition'
      | 'ReplaceWithTerminalTransition'
      | 'ReplaceWithBatch'
      | 'ClearTopology';
  }
>;
export type LinearRoomStateProjectCommand = Extract<
  ProjectCommand,
  { readonly kind: 'ReplaceBiomeField' | 'ReplaceOccurrenceRoom' }
>;
export type LinearRewardProjectCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceBatchRewardStore'
      | 'ReplaceFieldsCageOutcome'
      | 'ReplaceShipEncounterCount'
      | 'ReplaceRewardWheelOfferCount'
      | 'ReplaceRewardWheelStore'
      | 'ReplaceRewardWheelPicked'
      | 'ReplaceRewardWheelOffer'
      | 'ReplaceIncomingReward'
      | 'ReplaceLocalReward'
      | 'ReplaceShopOffer'
      | 'SetShopPurchase';
  }
>;
export type BiomeProjectCommand = Exclude<ProjectCommand, ProjectMetadataCommand>;
