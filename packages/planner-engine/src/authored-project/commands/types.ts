import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type {
  AcquisitionSiteAddress,
  AcquisitionEntryAddress,
  AdditionalExitAddress,
  BatchRewardStoreAddress,
  BiomeAddress,
  JudgmentArcanaAddress,
  FigurineArcanaAddress,
  KeepsakeSelectionAddress,
  KeepsakeEquipResultAddress,
  BiomeFieldAddress,
  ExitDecisionAddress,
  ExitSelectionAddress,
  EncounterPhaseAddress,
  NemesisRandomEventAddress,
  HubDecisionAddress,
  HubSlotAddress,
  IncomingRewardAddress,
  LocalVisitSlotAddress,
  LocalVisitOrderAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  RoomActionSemanticAddress,
  RouteAddress,
  ShopOfferAddress,
  TraitOfferAddress,
  AcquisitionRoleAddress,
  LevelResolutionAddress,
  SteadyGrowthOutcomeAddress,
  TranscendentEmbryoOutcomeAddress,
  FountainRarityOutcomeAddress,
  TargetAddress,
} from '../addresses';
import type {
  AuthoredFieldValue,
  ExitSelection,
  OccurrenceId,
  RoomActionReference,
} from '../model';
import type {
  AuthoredGorgonAthenaOffer,
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  TraitOptionKey,
} from '../traits';

export type ProjectStateCommand =
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
      readonly kind: 'ReplaceAspectHexTree';
      readonly route: RouteAddress;
      readonly value: import('../traits').AuthoredHexTreeConfiguration;
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

export type ResourcePlacementCommand = {
  readonly kind: 'ReplaceResourcePlacement';
  readonly route: RouteAddress;
  readonly family: import('../../catalog-schema').ResourceFamily;
  readonly value: import('../model').ResourcePlacement | null;
};

export type JudgmentArcanaCommand = {
  readonly kind: 'ReplaceJudgmentArcana';
  readonly judgment: JudgmentArcanaAddress;
  readonly arcanaKeys: readonly string[];
};
export type FigurineArcanaCommand = {
  readonly kind: 'ReplaceFigurineArcana';
  readonly figurine: FigurineArcanaAddress;
  readonly arcanaKeys: readonly string[];
};
export type SteadyGrowthCommand = {
  readonly kind: 'ReplaceSteadyGrowthTarget';
  readonly outcome: SteadyGrowthOutcomeAddress;
  readonly targetTraitKey: string | null;
};
export type FountainRarityCommand = {
  readonly kind: 'ReplaceFountainRarityTarget';
  readonly outcome: FountainRarityOutcomeAddress;
  readonly targetTraitKey: string | null;
};
export type KeepsakeCommand = {
  readonly kind: 'ReplacePostbossKeepsake';
  readonly selection: Extract<KeepsakeSelectionAddress, { readonly owner: OccurrenceAddress }>;
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
export type TranscendentEmbryoEquipResultCommand = {
  readonly kind: 'ReplaceTranscendentEmbryoEquipResult';
  readonly result: KeepsakeEquipResultAddress & { readonly resultKind: 'transcendentEmbryo' };
  readonly value: NonNullable<
    import('../model').AuthoredKeepsakeEquipResults['transcendentEmbryo']
  >;
};
export type TranscendentEmbryoTransformationCommand = {
  readonly kind: 'ReplaceTranscendentEmbryoTransformation';
  readonly outcome: TranscendentEmbryoOutcomeAddress;
  readonly blessingKey: string | null;
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
      readonly kind: 'InitializeExitDecision';
      readonly decision: ExitDecisionAddress;
      readonly edit:
        | { readonly kind: 'rewardStore'; readonly storeKey: string }
        | { readonly kind: 'fieldsCageOutcome'; readonly cageOutcome: 'min' | 'max' }
        | { readonly kind: 'hub'; readonly hub: HubDecisionAddress }
        | {
            readonly kind: 'target';
            readonly target: TargetAddress;
            readonly occurrenceId: OccurrenceId;
            readonly gameName: string;
          };
    }
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

/** Explicit edits to the sole persisted chronology owned by one occurrence. */
export type RoomActionCommand =
  | {
      readonly kind: 'InsertRoomAction';
      readonly action: RoomActionSemanticAddress;
      readonly reference: RoomActionReference;
      readonly index: number;
    }
  | { readonly kind: 'RemoveRoomAction'; readonly action: RoomActionSemanticAddress }
  | {
      readonly kind: 'MoveRoomAction';
      readonly action: RoomActionSemanticAddress;
      readonly toIndex: number;
    }
  | {
      /** Replaces membership of one declaration-owned initial Shop purchase. */
      readonly kind: 'ReplaceShopPurchaseParticipation';
      readonly offer: ShopOfferAddress;
      readonly purchased: boolean;
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
      readonly kind: 'AddSparkChaos';
      readonly additional: AdditionalExitAddress;
      readonly occurrenceId: OccurrenceId;
    }
  | {
      readonly kind: 'RemoveNaturalChaos';
      readonly additional: AdditionalExitAddress;
    }
  | {
      readonly kind: 'RemoveSparkChaos';
      readonly additional: AdditionalExitAddress;
    }
  | {
      readonly kind: 'ReplaceNaturalChaosMap';
      readonly occurrence: OccurrenceAddress;
      readonly gameName: string;
    }
  | {
      readonly kind: 'ReplaceSparkChaosMap';
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

export type FieldsOccurrenceCommand = {
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

export type ShopOccurrenceCommand = {
  readonly kind: 'ReplaceShopOffer';
  readonly offer: ShopOfferAddress;
  readonly value: ResolvedRewardOffer;
};
export type PurgingPoolCommand =
  | {
      readonly kind: 'SetPurgingPoolInteraction';
      readonly occurrence: OccurrenceAddress;
      readonly interacted: boolean;
    }
  | {
      readonly kind: 'ReplacePurgingPoolSlot';
      readonly occurrence: OccurrenceAddress;
      readonly slotKey: 'left' | 'middle' | 'right';
      readonly traitKey: string | null;
    };

export type HermesShrineCommand =
  | {
      readonly kind: 'SetHermesShrinePresence';
      readonly occurrence: OccurrenceAddress;
      readonly present: boolean;
    }
  | {
      readonly kind: 'ReplaceHermesShrineOffer';
      readonly occurrence: OccurrenceAddress;
      readonly slotKey: import('../model').HermesShrineSlotKey;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'SetHermesShrinePurchase';
      readonly occurrence: OccurrenceAddress;
      readonly generationKey: import('../model').HermesShrineGenerationKey;
      readonly purchase: import('../model').HermesShrinePurchase | null;
    }
  | {
      readonly kind: 'ReplaceHermesShrineTravelDealRefill';
      readonly occurrence: OccurrenceAddress;
      readonly value: ResolvedRewardOffer;
    };

export type StygianWellCommand =
  | { readonly kind: 'AddStygianWell'; readonly occurrence: OccurrenceAddress }
  | { readonly kind: 'RemoveStygianWell'; readonly occurrence: OccurrenceAddress }
  | {
      readonly kind: 'SetStygianWellInteraction';
      readonly occurrence: OccurrenceAddress;
      readonly interacted: boolean;
    }
  | {
      readonly kind: 'ReplaceStygianWellOffer';
      readonly occurrence: OccurrenceAddress;
      readonly slotKey: import('../model').StygianWellSlotKey;
      readonly itemKey: string | null;
    }
  | {
      readonly kind: 'SetStygianWellPurchase';
      readonly occurrence: OccurrenceAddress;
      readonly generationKey: import('../model').StygianWellGenerationKey;
      readonly purchased: boolean;
    }
  | {
      readonly kind: 'ReplaceStygianWellTwistResult';
      readonly occurrence: OccurrenceAddress;
      readonly generationKey: import('../model').StygianWellGenerationKey;
      readonly itemKey: string | null;
    }
  | {
      readonly kind: 'ReplaceStygianWellTravelDealRefill';
      readonly occurrence: OccurrenceAddress;
      readonly itemKey: string | null;
    };

export type AcquisitionSiteCommand =
  | {
      /** Replaces payload detail for one declaration-fixed site pickup. */
      readonly kind: 'ReplaceAcquisitionEntryOffer';
      readonly entry: AcquisitionEntryAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      /** Materializes one derived Shop entry; chronology insertion is a separate command. */
      readonly kind: 'SelectDerivedShopEntry';
      readonly site: AcquisitionSiteAddress;
      readonly entryKey: 'travelDealRefill' | 'echoDoubleShopReward';
      readonly sourceOfferKey: string;
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
      /** Complete replacement of the phase-local random-event realization. */
      readonly kind: 'ReplaceNemesisRandomEventOutcome';
      readonly event: NemesisRandomEventAddress;
      readonly value: import('../model').AuthoredNemesisRandomEventOutcome | null;
      /** The sole concrete result identity, persisted only at its generated entry. */
      readonly reward: ResolvedRewardOffer | null;
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
    }
  | {
      readonly kind: 'ReplaceConcaveStoneResult';
      readonly trait: TraitOfferAddress;
      readonly value: import('../traits').AuthoredConcaveStoneResult | null;
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

/** The realized Sea Star result at one normal concrete acquisition role. */
export type SeaStarResultCommand = {
  readonly kind: 'ReplaceSeaStarResult';
  readonly acquisition: AcquisitionRoleAddress;
  readonly procced: boolean;
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
  | PurgingPoolCommand
  | StygianWellCommand
  | HermesShrineCommand
  | EncounterOccurrenceCommand;

export type ProjectCommand =
  | ProjectStateCommand
  | ResourcePlacementCommand
  | JudgmentArcanaCommand
  | FigurineArcanaCommand
  | SteadyGrowthCommand
  | FountainRarityCommand
  | KeepsakeCommand
  | KeepsakeEquipResultCommand
  | ExperimentalHammerEquipResultCommand
  | TranscendentEmbryoEquipResultCommand
  | TranscendentEmbryoTransformationCommand
  | TopologyCommand
  | RoomReplacementCommand
  | RoomActionCommand
  | RouteDetourCommand
  | OccurrenceLeafCommand
  | AcquisitionSiteCommand
  | TraitOfferCommand
  | LevelResolutionCommand
  | AcquisitionDispositionCommand
  | SeaStarResultCommand
  | DerivedShopEntryEditCommand;

export type BiomeOwnedProjectCommand = Exclude<
  ProjectCommand,
  { readonly kind: 'ConfigureRoutePrefix' }
>;
