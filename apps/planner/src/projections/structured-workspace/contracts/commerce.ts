import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceCommandIntent } from '@planner/projections/structured-workspace/contract';
import type {
  AcquisitionEntryAddress,
  InfernalContractPedestalAddress,
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
  readonly rewardControl: WorkspaceExplicitRewardControl;
}

export type WorkspaceShopSupplementalDescriptor =
  | {
      readonly kind: 'echoDoubleShopPlaceholder';
      readonly key: 'echoDoubleShopReward';
      readonly label: string;
      readonly explanation: string;
    }
  | {
      readonly kind: 'travelDealInvalid' | 'echoDoubleShopInvalid';
      readonly key: 'travelDealRefill' | 'echoDoubleShopReward';
      readonly label: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
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

/** An exact item picker over a declared Shop-option pool: a Shop slot or the Contract pedestal. */
export interface WorkspaceShopOfferInteraction {
  readonly key: string;
  readonly owner: ShopOfferAddress | InfernalContractPedestalAddress;
  readonly selected: import('@run-planner/engine/reward-kernel').ShopOptionSelection | null;
  /** A null value clears a slot whose current item is no longer possible. */
  readonly load: () => Promise<
    ContextualPickerModel<import('@run-planner/engine/reward-kernel').ShopOptionSelection | null>
  >;
  readonly summary: string;
  readonly intentFor: (
    value: import('@run-planner/engine/reward-kernel').ShopOptionSelection | null,
  ) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind:
          | 'ReplaceShopOfferOption'
          | 'ClearShopOffer'
          | 'ReplaceInfernalContractPedestalOption'
          | 'ClearInfernalContractPedestal';
      }
    >
  >;
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

export interface WorkspaceHermesShrineOfferInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly slotKey:
    import('@run-planner/engine/authored-project').HermesShrineSlotKey | 'travelDealRefill';
  readonly rewardType: string | null;
  readonly candidateRewardTypes: readonly string[];
  /** The delay rolled with the stocked item; null while unstocked. */
  readonly delay: import('@run-planner/engine/authored-project').HermesShrineDelay | null;
  readonly load: () => ContextualPickerModel<string>;
  readonly intentFor: (
    rewardType: string,
  ) => WorkspaceCommandIntent<
    | Extract<ProjectCommand, { readonly kind: 'ReplaceHermesShrineOffer' }>
    | Extract<ProjectCommand, { readonly kind: 'ReplaceHermesShrineTravelDealRefill' }>
  >;
  /** Sets the delay rolled for the stocked item. */
  readonly delayIntentFor: (
    delay: import('@run-planner/engine/authored-project').HermesShrineDelay,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetHermesShrineOfferDelay' }>
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
