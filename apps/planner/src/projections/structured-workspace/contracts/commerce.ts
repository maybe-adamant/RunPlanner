import type {
  AcquisitionRoleAddress,
  AdditionalExitAddress,
  OccurrenceAddress,
  ProjectCommand,
  ShopOfferAddress,
} from '@run-planner/engine/authored-project';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type {
  WorkspaceCommandIntent,
  WorkspacePayloadEditIntent,
} from '@planner/projections/structured-workspace/contract';

export interface WorkspaceAcquisitionConversionInteraction {
  readonly visible: boolean;
  /** Gold is enabled only when every reached engine branch supports it. */
  readonly timePieceSupported: boolean;
  readonly artificerSupported: boolean;
  readonly seaStarSupported: boolean;
  readonly seaStarProcced: boolean;
  /** Exact acquisition-owned Anvil editor, present only on the purchased Anvil role. */
  readonly anvil?: {
    readonly value: import('@run-planner/engine/authored-project').AuthoredAnvilResult | null;
    readonly removableTraitKeys: readonly string[];
    readonly addedTraitKeysFor: (
      removedTraitKey: string | null,
      priorAddedTraitKeys: readonly string[],
    ) => readonly string[];
    readonly traitLabel: (traitKey: string) => string;
    readonly intentFor: (
      value: import('@run-planner/engine/authored-project').AuthoredAnvilResult,
    ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceAnvilResult' }>>;
  };
  readonly intentFor: (
    value: import('@run-planner/engine/authored-project').AcquisitionDisposition,
  ) => WorkspacePayloadEditIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
  >;
  readonly seaStarIntentFor: (
    procced: boolean,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceSeaStarResult' }>>;
  readonly key: string;
  readonly owner: AcquisitionRoleAddress;
  readonly value: import('@run-planner/engine/authored-project').AcquisitionDisposition;
}

export interface WorkspaceShopPurchaseParticipationInteraction {
  readonly key: string;
  readonly owner: ShopOfferAddress;
  readonly purchased: boolean;
  readonly intentFor: (
    purchased: boolean,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceShopPurchaseParticipation' }>
  >;
}

export interface WorkspaceShopOfferInteraction {
  readonly key: string;
  readonly owner: ShopOfferAddress;
  readonly selected: import('@run-planner/engine/reward-kernel').ShopOptionSelection | null;
  readonly load: () => Promise<
    ContextualPickerModel<import('@run-planner/engine/reward-kernel').ShopOptionSelection>
  >;
  readonly summary: string;
  readonly intentFor: (
    value: import('@run-planner/engine/reward-kernel').ShopOptionSelection,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceShopOfferOption' }>>;
}

/** Complete occurrence command binding for one physical Pool offer slot. */
export interface WorkspacePurgingPoolSlotInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly slotKey: 'left' | 'middle' | 'right';
  readonly traitKey: string | null;
  readonly load: () => ContextualPickerModel<string | null>;
  readonly intentFor: (
    traitKey: string | null,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplacePurgingPoolSlot' }>>;
}

/** Controls whether a fixed physical Pool has an authored exact inventory. */
export interface WorkspacePurgingPoolInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly interacted: boolean;
  readonly intentFor: (
    interacted: boolean,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetPurgingPoolInteraction' }>
  >;
}

export interface WorkspaceHermesShrinePurchaseInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly generationKey: import('@run-planner/engine/authored-project').HermesShrineGenerationKey;
  readonly purchase: import('@run-planner/engine/authored-project').HermesShrinePurchase | null;
  readonly intentFor: (
    purchase: import('@run-planner/engine/authored-project').HermesShrinePurchase | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetHermesShrinePurchase' }>
  >;
}

export interface WorkspaceHermesShrineOfferInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly slotKey:
    import('@run-planner/engine/authored-project').HermesShrineSlotKey | 'travelDealRefill';
  readonly rewardType: string | null;
  readonly candidateRewardTypes: readonly string[];
  readonly load: () => ContextualPickerModel<string>;
  readonly intentFor: (
    rewardType: string,
  ) => WorkspaceCommandIntent<
    | Extract<ProjectCommand, { readonly kind: 'ReplaceHermesShrineOffer' }>
    | Extract<ProjectCommand, { readonly kind: 'ReplaceHermesShrineTravelDealRefill' }>
  >;
}

export interface WorkspaceHermesShrinePresenceInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly present: boolean;
  readonly intentFor: (
    present: boolean,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetHermesShrinePresence' }>
  >;
}

export interface WorkspaceStygianWellPresenceInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly present: boolean;
  readonly intentFor: (
    present: boolean,
  ) => WorkspaceCommandIntent<
    | Extract<ProjectCommand, { readonly kind: 'AddStygianWell' }>
    | Extract<ProjectCommand, { readonly kind: 'RemoveStygianWell' }>
  >;
}

export interface WorkspaceStygianWellInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly interacted: boolean;
  readonly intentFor: (
    interacted: boolean,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetStygianWellInteraction' }>
  >;
}

export interface WorkspaceStygianWellOfferInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
  readonly itemKey: string | null;
  readonly candidateItemKeys: readonly string[];
  readonly load: () => ContextualPickerModel<string | null>;
  readonly intentFor: (
    itemKey: string | null,
  ) => WorkspaceCommandIntent<
    | Extract<ProjectCommand, { readonly kind: 'ReplaceStygianWellOffer' }>
    | Extract<ProjectCommand, { readonly kind: 'ReplaceStygianWellTravelDealRefill' }>
  >;
}

export interface WorkspaceStygianWellPurchaseInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
  readonly purchased: boolean;
  readonly intentFor: (
    purchased: boolean,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'SetStygianWellPurchase' }>>;
}

export interface WorkspaceStygianWellTwistResultInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
  readonly itemKey: string | null;
  readonly candidateItemKeys: readonly string[];
  readonly load: () => ContextualPickerModel<string | null>;
  readonly intentFor: (
    itemKey: string | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceStygianWellTwistResult' }>
  >;
}

/** A complete route command bound to one resource-family control at its host room. */
export interface WorkspaceResourcePlacementInteraction {
  readonly intent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceResourcePlacement' }>
  >;
  readonly key: string;
  readonly owner: OccurrenceAddress;
}

/** The Midshop workbench presents the declared additional door without making it a normal target. */
export interface WorkspaceZagreusContractInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly removeIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemoveZagreusContract' }>
  >;
  readonly selectIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetExitSelection' }>
  >;
}

/** Source-room availability binds only the creation command. */
export interface WorkspaceZagreusSpawnInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly spawnIntent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'AddZagreusContract' }>
  >;
}

/** A Chaos gate is authored at its source and selected at its outgoing decision. */
export interface WorkspaceChaosExitInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly mapIntent: (
    gameName: string,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceChaosMap' }>>;
  readonly removeIntent?: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemoveChaos' }>
  >;
  readonly selectIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetExitSelection' }>
  >;
}

/** Availability belongs to the active source room; the authored gate remains occurrence-owned. */
export interface WorkspaceChaosSpawnInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly spawnIntent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'AddChaos' }>
  >;
}
