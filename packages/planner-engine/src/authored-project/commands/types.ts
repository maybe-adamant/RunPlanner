import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type {
  BatchRewardStoreAddress,
  BiomeAddress,
  BiomeFieldAddress,
  ExitDecisionAddress,
  ExitSelectionAddress,
  HubDecisionAddress,
  HubSlotAddress,
  HubVisitAddress,
  IncomingRewardAddress,
  LocalChildAddress,
  LocalChildGroupAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  RouteAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from '../addresses';
import type { AuthoredFieldValue, ExitSelection, OccurrenceId } from '../model';

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
      readonly gameName?: string;
    }
  | {
      readonly kind: 'CreateLinkedExit';
      readonly decision: ExitDecisionAddress;
      readonly occurrenceId: OccurrenceId;
    }
  | { readonly kind: 'CreateBatch'; readonly decision: ExitDecisionAddress }
  | {
      readonly kind: 'CreateTarget';
      readonly target: TargetAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | {
      readonly kind: 'CreateTakeoverBatch';
      readonly decision: ExitDecisionAddress;
      readonly gameName: string;
      readonly targetOccurrenceIds: Readonly<Record<string, OccurrenceId>>;
    }
  | {
      readonly kind: 'ReplaceWithTakeoverBatch';
      readonly decision: ExitDecisionAddress;
      readonly gameName: string;
      readonly targetOccurrenceIds: Readonly<Record<string, OccurrenceId>>;
    }
  | {
      readonly kind: 'ReconcileTakeoverBatch';
      readonly decision: ExitDecisionAddress;
      readonly gameName: string;
      readonly targetOccurrenceIds: Readonly<Record<string, OccurrenceId>>;
    }
  | { readonly kind: 'ReconcileBatchExitCapacity'; readonly decision: ExitDecisionAddress }
  | { readonly kind: 'CreateHubDecision'; readonly hub: HubDecisionAddress }
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
  | {
      readonly kind: 'SetExitSelection';
      readonly selection: ExitSelectionAddress;
      readonly value: ExitSelection;
    }
  | { readonly kind: 'RemoveExitDecision'; readonly decision: ExitDecisionAddress }
  | {
      readonly kind: 'ReplaceBatchRewardStore';
      readonly rewardStore: BatchRewardStoreAddress;
      readonly storeKey: string;
    }
  | {
      readonly kind: 'ReplaceFieldsCageOutcome';
      readonly decision: ExitDecisionAddress;
      readonly cageOutcome: 'min' | 'max';
    }
  | {
      readonly kind: 'ReplaceOccurrenceRoom';
      readonly occurrence: OccurrenceAddress;
      readonly gameName: string;
    }
  | {
      readonly kind: 'ReplaceShipEncounterCount';
      readonly occurrence: OccurrenceAddress;
      readonly encounterCount: 2 | 3;
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
      readonly kind: 'ReplaceShopOffer';
      readonly offer: ShopOfferAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'SetShopPurchase';
      readonly purchase: ShopPurchaseAddress;
      readonly purchased: boolean;
    }
  | { readonly kind: 'ClearTopology'; readonly biome: BiomeAddress };

export type ProjectMetadataCommand = Extract<
  ProjectCommand,
  { readonly kind: 'RenameProject' | 'ConfigureRoutePrefix' }
>;
export type BiomeProjectCommand = Exclude<ProjectCommand, ProjectMetadataCommand>;
