import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type {
  AdditionalExitAddress,
  BatchRewardStoreAddress,
  BiomeAddress,
  BiomeFieldAddress,
  ExitDecisionAddress,
  ExitSelectionAddress,
  EncounterPhaseAddress,
  HubDecisionAddress,
  HubSlotAddress,
  IncomingRewardAddress,
  LocalChildAddress,
  LocalChildGroupAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  RouteAddress,
  ShopOfferAddress,
  TraitOfferAddress,
  TargetAddress,
} from '../addresses';
import type { AuthoredFieldValue, ExitSelection, OccurrenceId } from '../model';
import type { AuthoredTraitOffer, TraitOptionKey } from '../traits';

export type ProjectStateCommand =
  | { readonly kind: 'RenameProject'; readonly name: string }
  | {
      readonly kind: 'ReplaceRouteLoadout';
      readonly route: RouteAddress;
      readonly weaponKey: string;
      readonly aspectKey: string;
    }
  | {
      readonly kind: 'ConfigureRoutePrefix';
      readonly route: RouteAddress;
      readonly configuredBiomeCount: number;
    }
  | {
      readonly kind: 'ReplaceBiomeField';
      readonly field: BiomeFieldAddress;
      readonly value: AuthoredFieldValue;
    };

export type TopologyCommand =
  | {
      readonly kind: 'CreateStart';
      readonly biome: BiomeAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName?: string;
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
  | {
      readonly kind: 'ReplaceWithHubDecision';
      readonly decision: ExitDecisionAddress;
      readonly hub: HubDecisionAddress;
    }
  | { readonly kind: 'RemoveHubDecision'; readonly hub: HubDecisionAddress }
  | {
      readonly kind: 'OpenHubSlot';
      readonly slot: HubSlotAddress;
      readonly occurrenceId: OccurrenceId;
    }
  | { readonly kind: 'CloseHubSlot'; readonly slot: HubSlotAddress }
  | {
      readonly kind: 'ReplaceHubVisitOrder';
      readonly hub: HubDecisionAddress;
      readonly hubSlotKeys: readonly string[];
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
  | { readonly kind: 'ClearTopology'; readonly biome: BiomeAddress };

export type RoomReplacementCommand = {
  readonly kind: 'ReplaceOccurrenceRoom';
  readonly occurrence: OccurrenceAddress;
  readonly gameName: string;
};

/**
 * The two currently supported route detours have closed, declaration-owned
 * command shapes. They intentionally do not generalize normal target
 * replacement or additional exits into an ambient feature family.
 */
export type RouteDetourCommand =
  | {
      readonly kind: 'SwitchTargetToAnomaly';
      readonly target: TargetAddress;
    }
  | {
      readonly kind: 'ReplaceAnomalyMap';
      readonly occurrence: OccurrenceAddress;
      readonly gameName: string;
    }
  | {
      readonly kind: 'ReplaceAnomalySuccess';
      readonly occurrence: OccurrenceAddress;
      readonly success: boolean;
    }
  | {
      readonly kind: 'RevertAnomaly';
      readonly occurrence: OccurrenceAddress;
    }
  | {
      readonly kind: 'AddZagreusContract';
      readonly additional: AdditionalExitAddress;
      readonly occurrenceId: OccurrenceId;
    }
  | {
      readonly kind: 'RemoveZagreusContract';
      readonly additional: AdditionalExitAddress;
    }
  | {
      readonly kind: 'AddNaturalChaos';
      readonly additional: AdditionalExitAddress;
      readonly occurrenceId: OccurrenceId;
    }
  | {
      readonly kind: 'RemoveNaturalChaos';
      readonly additional: AdditionalExitAddress;
    }
  | {
      readonly kind: 'ReplaceNaturalChaosMap';
      readonly occurrence: OccurrenceAddress;
      readonly gameName: string;
    };

export type IncomingRewardCommand = {
  readonly kind: 'ReplaceIncomingReward';
  readonly reward: IncomingRewardAddress;
  readonly value: ResolvedRewardOffer;
};

export type LocalRewardCommand = {
  readonly kind: 'ReplaceLocalReward';
  readonly reward: LocalRewardAddress;
  readonly value: ResolvedRewardOffer;
};

export type ShipOccurrenceCommand =
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
    };

export type EphyraOccurrenceCommand =
  | {
      readonly kind: 'ReplaceSideRoomGeneration';
      readonly sideRoom: LocalChildAddress;
      readonly generation: 'generated' | 'notGenerated';
    }
  | {
      readonly kind: 'ReplaceSideRoomEntryOrder';
      readonly group: LocalChildGroupAddress;
      readonly enteredSlotKeys: readonly string[];
    };

export type ShopOccurrenceCommand =
  | {
      readonly kind: 'ReplaceShopOffer';
      readonly offer: ShopOfferAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'ReplaceShopPurchaseOrder';
      readonly shop: OccurrenceAddress;
      readonly offerKeys: readonly string[];
    }
  | {
      readonly kind: 'ReplaceShopDeathDefianceCondition';
      readonly shop: OccurrenceAddress;
      readonly value: boolean;
    };

export type EncounterOccurrenceCommand =
  | {
      readonly kind: 'SelectEncounter';
      readonly phase: EncounterPhaseAddress;
      readonly encounterKey: string;
    }
  | {
      readonly kind: 'ResetEncounter';
      readonly phase: EncounterPhaseAddress;
    };

export type TraitOfferCommand =
  | {
      readonly kind: 'ReplaceTraitOffer';
      readonly trait: TraitOfferAddress;
      readonly value: AuthoredTraitOffer;
    }
  | {
      readonly kind: 'ReplaceTraitSelection';
      readonly trait: TraitOfferAddress;
      readonly selectedOptionKey: TraitOptionKey;
    };

export type OccurrenceLeafCommand =
  | IncomingRewardCommand
  | LocalRewardCommand
  | ShipOccurrenceCommand
  | EphyraOccurrenceCommand
  | ShopOccurrenceCommand
  | EncounterOccurrenceCommand;

export type ProjectCommand =
  | ProjectStateCommand
  | TopologyCommand
  | RoomReplacementCommand
  | RouteDetourCommand
  | OccurrenceLeafCommand
  | TraitOfferCommand;

export type BiomeOwnedProjectCommand = Exclude<
  ProjectCommand,
  { readonly kind: 'RenameProject' | 'ConfigureRoutePrefix' }
>;
