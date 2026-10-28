import type {
  WorkspaceCommandIntent,
  WorkspaceFeatureAssessment,
  WorkspaceFeaturePresence,
  WorkspaceInteractionChoice,
} from '@planner/projections/structured-workspace/contract';
import type {
  AcquisitionEntryAddress,
  AdditionalExitAddress,
  OccurrenceAddress,
  ProjectCommand,
  RoomFeatureAddress,
} from '@run-planner/engine/authored-project';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceMarker } from './navigation';
import type { WorkspaceDoorContract } from './structure';
import type { WorkspaceExplicitRewardControl } from './rewards';

export type WorkspaceRoomFeature =
  | {
      readonly kind: 'nemesisEvent';
      readonly action: 'add' | 'remove';
      readonly interactionKey: string;
    }
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'add';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalAbsent' }>;
      readonly control: WorkspaceZagreusSpawnControl;
    }
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'remove';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalPresent' }>;
      readonly owner: AdditionalExitAddress;
    }
  | {
      readonly kind: 'chaos';
      readonly action: 'add';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalAbsent' }>;
      readonly control: WorkspaceChaosSpawnControl;
    }
  | {
      readonly kind: 'chaos';
      readonly action: 'remove';
      readonly marker: WorkspaceMarker;
      readonly position?: {
        readonly value: number | null;
        readonly choices: readonly number[];
        readonly invalid: boolean;
      };
      readonly presence:
        | Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalPresent' }>
        | Extract<WorkspaceFeaturePresence, { readonly kind: 'forcedPresent' }>;
      readonly owner: AdditionalExitAddress;
    }
  | {
      /** Fixed Postboss inventory; candidates are produced by the engine assessment. */
      readonly kind: 'purgingPool';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly inventoryAddress: RoomFeatureAddress;
      readonly inventoryMarker: WorkspaceMarker;
      readonly interactionKey: string;
      readonly interacted: boolean;
      /** The next sale or reroll, appended at the end of the room's actions. */
      readonly rollActions?: WorkspaceFeatureRollActions;
      readonly slots: readonly {
        readonly candidateTraitKeys: readonly string[];
        readonly candidateTraits: readonly { readonly key: string; readonly label: string }[];
        readonly interactionKey: string;
        readonly key: 'left' | 'middle' | 'right';
        readonly label: string;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly traitLabel?: string;
        readonly traitKey: string | null;
      }[];
    }
  | {
      /** Shrine inventory is always visible and authored once present. */
      readonly kind: 'hermesShrine';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly presence: WorkspaceFeaturePresence;
      readonly presenceAddress: RoomFeatureAddress;
      readonly presenceMarker: WorkspaceMarker;
      readonly inventoryAddress?: RoomFeatureAddress;
      readonly inventoryMarker?: WorkspaceMarker;
      readonly presenceInteractionKey?: string;
      readonly slots: readonly {
        readonly key: import('@run-planner/engine/authored-project').HermesShrineSlotKey;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly label: string;
        readonly rewardType: string | null;
        readonly rewardLabel?: string;
        readonly candidateRewardTypes: readonly string[];
        readonly candidateRewards: readonly {
          readonly rewardType: string;
          readonly label: string;
        }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchase:
          import('@run-planner/engine/authored-project').HermesShrinePurchase | null;
      }[];
      /** Refill inventory, authored on the timeline under the purchase that triggers it. */
      readonly travelDealRefill?: {
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly rewardType: string | null;
        readonly rewardLabel?: string;
        readonly candidateRewardTypes: readonly string[];
        readonly candidateRewards: readonly {
          readonly rewardType: string;
          readonly label: string;
        }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchase:
          import('@run-planner/engine/authored-project').HermesShrinePurchase | null;
        /** The rushed purchase that triggers the refill; absent while Travel Deal does not apply. */
        readonly sourceGenerationKey?: import('@run-planner/engine/authored-project').HermesShrineGenerationKey;
      };
    }
  | {
      /** The Preboss Contract pedestal's one free item and whether it is collected. */
      readonly kind: 'infernalContractPedestal';
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly collect: {
        /** The collected item's acquisition, which owns its availability findings. */
        readonly address: AcquisitionEntryAddress;
        readonly marker: WorkspaceMarker;
        readonly interactionKey: string;
        readonly collected: boolean;
      };
    }
  | {
      readonly kind: 'stygianWell';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly presence: WorkspaceFeaturePresence;
      readonly presenceAddress: RoomFeatureAddress;
      readonly presenceMarker: WorkspaceMarker;
      readonly inventoryAddress?: RoomFeatureAddress;
      readonly inventoryMarker?: WorkspaceMarker;
      readonly presenceInteractionKey?: string;
      readonly interactionKey?: string;
      readonly interacted: boolean;
      /** The initial stock. */
      readonly slots: readonly WorkspaceStygianWellSlot[];
      /** The next purchase or reroll, appended at the end of the room's actions. */
      readonly rollActions?: WorkspaceFeatureRollActions;
      /** Refill inventory, authored on the timeline under the purchase that triggers it. */
      readonly travelDealRefill?: Omit<WorkspaceStygianWellSlot, 'key'> & {
        readonly key: 'travelDealRefill';
        /** The first purchase that triggers the refill; absent while Travel Deal does not apply. */
        readonly sourceGenerationKey?: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
      };
    };

export interface WorkspaceStygianWellSlot {
  readonly key: import('@run-planner/engine/authored-project').StygianWellSlotKey;
  readonly generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
  readonly address: RoomFeatureAddress;
  readonly marker: WorkspaceMarker;
  readonly label: string;
  readonly itemKey: string | null;
  readonly itemLabel?: string;
  readonly candidateItemKeys: readonly string[];
  readonly candidateItems: readonly { readonly key: string; readonly label: string }[];
  readonly offerInteractionKey: string;
  readonly purchaseInteractionKey: string;
  readonly purchased: boolean;
}

/** Why a Well or Pool option cannot be picked where it would be appended. */
export type WorkspaceFeatureRollLock =
  | 'unreached'
  | 'notEnabled'
  | 'nothingLeft'
  | 'poolEmpty'
  | 'poolShort'
  | 'poolReserved'
  | 'itemFirst'
  | 'traitFirst';

/** One thing a Well or Pool visit can do next: buy or sell an offered slot, or reroll. */
export interface WorkspaceFeatureRollOption {
  readonly key: string;
  readonly kind: 'offer' | 'reroll';
  readonly label: string;
  /** An unpinned reroll slot: picking it first chooses its item or trait. */
  readonly needsChoice?: true;
  readonly locked?: WorkspaceFeatureRollLock;
}

/** The Interact picker of one Well or Pool. */
export interface WorkspaceFeatureRollActions {
  readonly interactionKey: string;
  readonly feature: import('@run-planner/engine/authored-project').RollFeature;
  /** Empty while the end of the room's actions is unreached. */
  readonly options: readonly WorkspaceFeatureRollOption[];
  readonly locked?: 'unreached';
}

/** One restocked slot of a Well or Pool reroll, optionally pinned on its Timeline row. */
export interface WorkspaceFeatureRollSlot {
  readonly slotKey: string;
  readonly label: string;
  readonly address: RoomFeatureAddress;
  readonly marker: WorkspaceMarker;
  readonly interactionKey: string;
  readonly value: string | null;
  readonly valueLabel?: string;
  /** The items or traits the roll can restock here; empty while it is unreached. */
  readonly candidates: readonly { readonly key: string; readonly label: string }[];
  readonly assessed: boolean;
}

type FeatureRollCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'SetStygianWellPurchase'
      | 'InsertStygianWellReroll'
      | 'InsertRoomAction'
      | 'SellPurgingPoolRollSlot'
      | 'InsertPurgingPoolReroll';
  }
>;

/** Engine-backed options of one Well or Pool's Interact picker. */
export interface WorkspaceFeatureRollActionsInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  /** The action an option appends when it needs no choice. */
  readonly intentFor: (optionKey: string) => WorkspaceCommandIntent<FeatureRollCommand>;
  /** The item or trait an unpinned reroll slot is bought or sold as. */
  readonly choices: (optionKey: string) => ContextualPickerModel<string>;
  readonly choiceIntentFor: (
    optionKey: string,
    value: string,
  ) => WorkspaceCommandIntent<FeatureRollCommand>;
}

/** One restocked slot's pin on a Well or Pool reroll. */
export interface WorkspaceFeatureRollSlotInteraction {
  readonly key: string;
  /** The reroll whose slot this pins. */
  readonly owner: import('@run-planner/engine/authored-project').RoomActionAddress;
  readonly load: () => ContextualPickerModel<string | null>;
  readonly intentFor: (
    value: string | null,
  ) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ReplaceStygianWellRollOffer' | 'ReplacePurgingPoolRollSlot' }
    >
  >;
}

export type WorkspaceHermesShrineTravelDealRefill = NonNullable<
  Extract<WorkspaceRoomFeature, { readonly kind: 'hermesShrine' }>['travelDealRefill']
>;
export type WorkspaceStygianWellTravelDealRefill = NonNullable<
  Extract<WorkspaceRoomFeature, { readonly kind: 'stygianWell' }>['travelDealRefill']
>;

export interface WorkspaceZagreusContractControl {
  readonly door: WorkspaceDoorContract;
  readonly exitTypeKey: string;
  readonly exitTypeLabel: string;
  /** The destination room's declared fixed reward. */
  readonly fixedRewardLabel: string;
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
  readonly selected: boolean;
}

/** Availability is source-room-local; the additional exit remains decision-owned. */
export interface WorkspaceZagreusSpawnControl {
  readonly marker: WorkspaceMarker;
  readonly materialized: boolean;
  readonly owner: AdditionalExitAddress;
}

export interface WorkspaceChaosExitControl {
  readonly door: WorkspaceDoorContract;
  readonly exitTypeKey: string;
  readonly exitTypeLabel: string;
  /** The destination room's declared fixed reward. */
  readonly fixedRewardLabel: string;
  readonly forced: boolean;
  readonly kind: 'chaos';
  readonly mapChoices: readonly WorkspaceInteractionChoice<string>[];
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
  readonly selected: boolean;
}

export interface WorkspaceChaosSpawnControl {
  readonly authorable: boolean;
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
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
  readonly positionIntent: (
    spawnPointIndex: number | null,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'SetChaosSpawnPoint' }>>;
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
