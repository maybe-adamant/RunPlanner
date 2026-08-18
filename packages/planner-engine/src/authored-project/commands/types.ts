import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type {
  AcquisitionSiteAddress,
  AcquisitionEntryAddress,
  AdditionalExitAddress,
  BatchRewardStoreAddress,
  BiomeAddress,
  BossCompletionArcanaAddress,
  CompletionRoomAddress,
  KeepsakeSelectionAddress,
  KeepsakeEquipResultAddress,
  BiomeFieldAddress,
  ExitDecisionAddress,
  ExitSelectionAddress,
  EncounterPhaseAddress,
  HubDecisionAddress,
  HubSlotAddress,
  IncomingRewardAddress,
  LocalVisitSlotAddress,
  LocalVisitOrderAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  RouteAddress,
  ShopOfferAddress,
  TraitOfferAddress,
  AcquisitionRoleAddress,
  LevelResolutionAddress,
  TargetAddress,
} from '../addresses';
import type { AuthoredFieldValue, ExitSelection, OccurrenceId } from '../model';
import type {
  AuthoredGorgonAthenaOffer,
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  TraitOptionKey,
} from '../traits';

export type ProjectStateCommand =
  | { readonly kind: 'RenameProject'; readonly name: string }
  | {
      readonly kind: 'ReplaceStartingKeepsake';
      readonly selection: Extract<KeepsakeSelectionAddress, { readonly owner: 'routeStart' }>;
      readonly keepsakeKey: string;
    }
  | {
      readonly kind: 'ReplaceRouteLoadout';
      readonly route: RouteAddress;
      readonly weaponKey: string;
      readonly aspectKey: string;
    }
  | {
      readonly kind: 'ReplaceManualArcanaSelection';
      readonly route: RouteAddress;
      readonly arcanaKeys: readonly string[];
    }
  | {
      readonly kind: 'ReplaceFearVowRank';
      readonly route: RouteAddress;
      readonly vowKey: string;
      readonly rank: number;
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

export type BossCompletionCommand = {
  readonly kind: 'ReplaceBossCompletionArcana';
  readonly completion: BossCompletionArcanaAddress;
  readonly arcanaKeys: readonly string[];
};
export type KeepsakeCommand = {
  readonly kind: 'ReplacePostbossKeepsake';
  readonly selection: Extract<KeepsakeSelectionAddress, { readonly owner: CompletionRoomAddress }>;
  readonly value: import('../model').PostbossKeepsakeDisposition;
};
export type KeepsakeEquipResultCommand = {
  readonly kind: 'ReplaceJeweledPomEquipResult';
  readonly result: KeepsakeEquipResultAddress & { readonly resultKind: 'jeweledPom' };
  readonly value: NonNullable<import('../model').AuthoredKeepsakeEquipResults['jeweledPom']>;
};
export type ExperimentalHammerEquipResultCommand = {
  readonly kind: 'ReplaceExperimentalHammerEquipResult';
  readonly result: KeepsakeEquipResultAddress & { readonly resultKind: 'experimentalHammer' };
  readonly value: NonNullable<
    import('../model').AuthoredKeepsakeEquipResults['experimentalHammer']
  >;
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
      readonly localOccurrenceIdsBySlot: Readonly<Record<string, OccurrenceId>>;
    }
  | { readonly kind: 'CloseHubSlot'; readonly slot: HubSlotAddress }
  | {
      readonly kind: 'ReplaceHubVisitOrder';
      readonly hub: HubDecisionAddress;
      readonly hubSlotKeys: readonly string[];
    }
  | LocalVisitCommand
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

export type FieldsOccurrenceCommand =
  | {
      readonly kind: 'ReplaceFieldsActionOrder';
      readonly occurrence: OccurrenceAddress;
      readonly actionOrder: readonly import('../model').FieldsCombatAction[];
    }
  | {
      readonly kind: 'ReplaceFieldsOptionalRewardCount';
      readonly occurrence: OccurrenceAddress;
      readonly optionalRewardCount: number;
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

export type LocalVisitCommand =
  | {
      readonly kind: 'SetLocalVisitGeneration';
      readonly slot: LocalVisitSlotAddress;
      readonly generation: 'generated' | 'notGenerated';
    }
  | {
      readonly kind: 'ReplaceLocalVisitOrder';
      readonly order: LocalVisitOrderAddress;
      readonly occurrenceIds: readonly OccurrenceId[];
    };

export type ShopOccurrenceCommand =
  | {
      readonly kind: 'ReplaceShopOffer';
      readonly offer: ShopOfferAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'ReplaceShopDeathDefianceCondition';
      readonly shop: OccurrenceAddress;
      readonly value: boolean;
    };

export type AcquisitionSiteCommand =
  | {
      readonly kind: 'ReplaceAcquisitionOrder';
      readonly site: AcquisitionSiteAddress;
      readonly entryKeys: readonly string[];
    }
  | {
      /** Replaces payload detail for one declaration-fixed site pickup. */
      readonly kind: 'ReplaceAcquisitionEntryOffer';
      readonly entry: AcquisitionEntryAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      /** Atomically materializes and selects one derived Shop entry. */
      readonly kind: 'SelectDerivedShopEntry';
      readonly site: AcquisitionSiteAddress;
      readonly entryKey: 'travelDealRefill' | 'echoDoubleShopReward';
      readonly sourceOfferKey: string;
      readonly entryKeys: readonly string[];
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
    }
  | {
      readonly kind: 'ReplaceFigLeafSkip';
      readonly phase: EncounterPhaseAddress;
      readonly value: boolean;
    }
  | {
      readonly kind: 'ReplaceGorgonDeathDefianceCondition';
      readonly phase: EncounterPhaseAddress;
      readonly value: boolean;
    };

export type TraitOfferCommand =
  | {
      readonly kind: 'ReplaceTraitOffer';
      readonly trait: TraitOfferAddress;
      readonly value: AuthoredTraitOffer;
    }
  | {
      /** Clears only an encounter-owned generated offer back to unresolved. */
      readonly kind: 'ResetEncounterTraitOffer';
      readonly trait: TraitOfferAddress;
    }
  | {
      readonly kind: 'ReplaceGorgonAthenaOffer';
      readonly trait: TraitOfferAddress;
      readonly value: AuthoredGorgonAthenaOffer;
    }
  | {
      readonly kind: 'ReplaceTraitSelection';
      readonly trait: TraitOfferAddress;
      readonly selectedOptionKey: TraitOptionKey;
    };

export type LevelResolutionCommand = {
  readonly kind: 'ReplaceLevelResolution';
  readonly levelResolution: LevelResolutionAddress;
  readonly value: AuthoredLevelResolution;
};

/** Exact closed disposition on one declaration-owned acquisition role. */
export type AcquisitionDispositionCommand = {
  readonly kind: 'ReplaceAcquisitionDisposition';
  readonly acquisition: AcquisitionRoleAddress;
  readonly value: import('../model').AcquisitionDisposition;
};

/** One payload edit whose acquisition-entry default may not be persisted yet. */
export type DerivedShopEntryPayloadCommand =
  | Extract<AcquisitionSiteCommand, { readonly kind: 'ReplaceAcquisitionEntryOffer' }>
  | Exclude<TraitOfferCommand, { readonly kind: 'ResetEncounterTraitOffer' }>
  | LevelResolutionCommand
  | AcquisitionDispositionCommand;

/** Atomically materializes one derived Shop entry from its exact source and
 * applies a complete payload edit without changing Shop acquisition chronology. */
export type DerivedShopEntryEditCommand = {
  readonly kind: 'EditDerivedShopEntry';
  readonly site: AcquisitionSiteAddress;
  readonly entryKey: 'travelDealRefill' | 'echoDoubleShopReward';
  readonly sourceOfferKey: string;
  readonly edit: DerivedShopEntryPayloadCommand;
};

export type OccurrenceLeafCommand =
  | IncomingRewardCommand
  | LocalRewardCommand
  | FieldsOccurrenceCommand
  | ShipOccurrenceCommand
  | ShopOccurrenceCommand
  | EncounterOccurrenceCommand;

export type ProjectCommand =
  | ProjectStateCommand
  | BossCompletionCommand
  | KeepsakeCommand
  | KeepsakeEquipResultCommand
  | ExperimentalHammerEquipResultCommand
  | TopologyCommand
  | RoomReplacementCommand
  | RouteDetourCommand
  | OccurrenceLeafCommand
  | AcquisitionSiteCommand
  | TraitOfferCommand
  | LevelResolutionCommand
  | AcquisitionDispositionCommand
  | DerivedShopEntryEditCommand;

export type BiomeOwnedProjectCommand = Exclude<
  ProjectCommand,
  { readonly kind: 'RenameProject' | 'ConfigureRoutePrefix' }
>;
