import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceCommandIntent } from '@planner/projections/structured-workspace/contract';
import type {
  AcquisitionEntryAddress,
  OccurrenceAddress,
  ProjectCommand,
  RoomActionReference,
  ShopOfferAddress,
} from '@run-planner/engine/authored-project';
import type { WorkspaceMarker } from './navigation';
import type { WorkspaceExplicitRewardControl } from './rewards';

export interface WorkspaceShopPurchaseDescriptor {
  readonly address: AcquisitionEntryAddress;
  readonly marker: WorkspaceMarker;
}

export interface WorkspaceShopSupplementalPurchaseDescriptor extends WorkspaceShopPurchaseDescriptor {
  readonly purchased: boolean;
  readonly reference: Extract<RoomActionReference, { readonly kind: 'interactAcquisitionEntry' }>;
}

export interface WorkspaceShopOfferDescriptor {
  readonly key: string;
  readonly label: string;
  readonly purchase: WorkspaceShopPurchaseDescriptor;
  readonly participation: {
    readonly interactionKey: string;
    readonly owner: ShopOfferAddress;
    readonly purchased: boolean;
  };
  readonly rewardControl: WorkspaceExplicitRewardControl;
}

export type WorkspaceShopSupplementalDescriptor =
  | {
      readonly kind: 'travelDealPlaceholder' | 'echoDoubleShopPlaceholder';
      readonly key: 'travelDealRefill' | 'echoDoubleShopReward';
      readonly label: string;
      readonly explanation: string;
    }
  | {
      readonly kind: 'travelDealInvalid' | 'echoDoubleShopInvalid';
      readonly key: 'travelDealRefill' | 'echoDoubleShopReward';
      readonly label: string;
      readonly explanation: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
    }
  | {
      readonly kind: 'infernalContractReward';
      readonly key: string;
      readonly label: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
    }
  | {
      readonly kind: 'travelDealRefill';
      readonly key: string;
      readonly label: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
      readonly sourceOfferKey: string;
    }
  | {
      readonly kind: 'echoDoubleShopReward';
      readonly key: 'echoDoubleShopReward';
      readonly label: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
      readonly sourceOfferKey: string;
      readonly eligibleSourceOfferKeys: readonly string[];
    };

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
